import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { buildFeedWsUrl, buildFeedStatusUrl, shouldUseFeedDevProxy } from '../config/endpoints';
import { extractMarketTicks, extractStreamedSymbols, getMarketPriceDirection, mapFeedStatusRows, validMarketPrice } from '../utils/marketWatch';
import { createBrowserDeferredPersistStorage } from './deferredPersistStorage';
import { getFeedOriginError, getFeedReconnectDelayMs } from './feedConnectionPolicy';

const STATUS_SYNC_TTL_MS = 10000;
// Re-read the streamed symbol inventory so SuperAdmin changes appear without a reload.
const STATUS_POLL_MS = 15000;
const symbolPersistStorage = createBrowserDeferredPersistStorage();

const getCurrentBrokerScope = () => {
  try {
    return String(localStorage.getItem('brokerId') || 'anonymous').trim();
  } catch {
    return 'anonymous';
  }
};

const getSymbolPersistKey = (scope = getCurrentBrokerScope()) =>
  `rtx-symbols-storage:${encodeURIComponent(scope)}`;

const scheduleTickBatch = (callback) => {
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    return { type: 'frame', id: window.requestAnimationFrame(callback) };
  }
  return { type: 'timer', id: setTimeout(callback, 16) };
};

const cancelTickBatch = (handle) => {
  if (!handle) return;
  if (handle.type === 'frame' && typeof window !== 'undefined') {
    window.cancelAnimationFrame(handle.id);
    return;
  }
  clearTimeout(handle.id);
};

const CATEGORIES = {
  METALS: 'Metals',
  FOREX: 'Forex',
  INDICES: 'Indices',
  CRYPTO: 'Crypto',
  COMMODITIES: 'Commodities',
  OTHERS: 'Others',
};

const getCategory = (symbol) => {
  const sym = String(symbol || '').toUpperCase();
  
  // Metals
  if (/(XAU|XAG|XPT|XPD|GOLD|SILVER|PLATINUM|PALLADIUM)/.test(sym)) return CATEGORIES.METALS;
  
  // Crypto
  if (/(BTC|ETH|LTC|XRP|SOL|ADA|DOT|DOGE|SHIB|MATIC|BNB)/.test(sym)) return CATEGORIES.CRYPTO;
  
  // Indices
  if (/(US30|NAS100|SPX500|GER30|UK100|DAX|FRA40|HK50|EUSTX50|JPN225|WS30)/.test(sym)) return CATEGORIES.INDICES;
  
  // Commodities
  if (/(OIL|WTI|BRENT|GAS|NATGAS|COFFEE|SUGAR|CORN|WHEAT)/.test(sym)) return CATEGORIES.COMMODITIES;
  
  // Forex - Usually 6 letters or with a separator, and not matched above
  if (/^[A-Z]{6}$/.test(sym) || sym.includes('/') || sym.includes('.')) return CATEGORIES.FOREX;

  return CATEGORIES.OTHERS;
};

const sameNames = (names, set) => Array.isArray(names) && names.length === set.size && names.every((name) => set.has(name));

const useSymbolStore = create(
  persist(
    (set, get) => ({
      symbols: {}, // Object keyed by symbol name: { symbol, bid, ask, lastUpdate, category }
      symbolMetadata: [], // Stable list of metadata
      ws: null,
      isConnected: false,
      feedError: '',
      feedOriginBlocked: false,
      shouldReconnect: false,
      connectionGeneration: 0,
      reconnectTimer: null,
      brokerScope: getCurrentBrokerScope(),
      statusSyncPromise: null,
      lastStatusSyncAt: 0,
      statusPollTimer: null,
      feedSymbolNames: null, // streamed symbols from the feed status; null until known

      upsertSymbols: (dataArray) => {
        const known = get().feedSymbolNames ? new Set(get().feedSymbolNames) : null;
        let unknownSymbol = false;
        set((state) => {
          const nextSymbols = { ...state.symbols };
          const now = Date.now();
          let metadataUpdated = false;

          dataArray.forEach((data) => {
            const { symbol, bid, ask } = data;
            if (!symbol || (!validMarketPrice(bid) && !validMarketPrice(ask))) return;
            const sym = String(symbol).trim().toUpperCase();
            // Only symbols in the streamed inventory are listed; a new one is
            // picked up by the status sync below.
            if (known && !known.has(sym)) {
              unknownSymbol = true;
              return;
            }
            if (!nextSymbols[sym]) metadataUpdated = true;

            const category = getCategory(sym);
            const prev = nextSymbols[sym];
            const numBid = validMarketPrice(bid) ? Number(bid) : null;
            const numAsk = validMarketPrice(ask) ? Number(ask) : null;
            const bidDir = numBid === null
              ? (prev?.live ? prev.bidDir : null) ?? null
              : getMarketPriceDirection(numBid, prev?.live ? prev.bid : null, prev?.bidDir);
            const askDir = numAsk === null
              ? (prev?.live ? prev.askDir : null) ?? null
              : getMarketPriceDirection(numAsk, prev?.live ? prev.ask : null, prev?.askDir);

            nextSymbols[sym] = {
              ...(prev || {}),
              symbol: sym,
              bid: numBid !== null ? numBid.toFixed(5) : (prev?.bid || null),
              ask: numAsk !== null ? numAsk.toFixed(5) : (prev?.ask || null),
              bidDir,
              askDir,
              dir: bidDir ?? askDir,
              live: true,
              lastUpdate: now,
              category,
            };
          });

          const nextState = { symbols: nextSymbols };

          // Recompute metadata if it's empty or a new symbol was added
          if (
            metadataUpdated ||
            (state.symbolMetadata && state.symbolMetadata.length === 0 && Object.keys(nextSymbols).length > 0)
          ) {
            nextState.symbolMetadata = Object.values(nextSymbols)
              .map((s) => ({ symbol: s.symbol, category: s.category || getCategory(s.symbol) }))
              .filter((s) => s.symbol)
              .sort((a, b) => a.symbol.localeCompare(b.symbol));
          }

          return nextState;
        });
        if (unknownSymbol) get().syncAvailableSymbols();
      },

      initWebSocket: () => {
        if (get().ws) return;

        const nextBrokerScope = getCurrentBrokerScope();
        const generation = get().connectionGeneration + 1;
        const existingTimer = get().reconnectTimer;
        const existingStatusPoll = get().statusPollTimer;
        if (existingTimer) clearTimeout(existingTimer);
        if (existingStatusPoll) clearInterval(existingStatusPoll);

        if (nextBrokerScope !== get().brokerScope) {
          // Never expose quotes or metadata from a previously authenticated broker.
          set({
            brokerScope: nextBrokerScope,
            symbols: {},
            symbolMetadata: [],
            feedSymbolNames: null,
            feedError: '',
            isConnected: false,
          });
          useSymbolStore.persist.setOptions({ name: getSymbolPersistKey(nextBrokerScope) });
          useSymbolStore.persist.rehydrate();
        }

        set((state) => ({
          connectionGeneration: generation,
          shouldReconnect: true,
          reconnectTimer: null,
          statusPollTimer: null,
          statusSyncPromise: null,
          lastStatusSyncAt: 0,
          feedOriginBlocked: false,
          feedError: '',
          symbols: Object.fromEntries(
            Object.entries(state.symbols).map(([key, value]) => [key, { ...value, live: false }])
          ),
        }));

        const isCurrent = () => get().connectionGeneration === generation &&
          get().shouldReconnect && getCurrentBrokerScope() === nextBrokerScope;
        let reconnectAttempt = 0;

        const connect = () => {
          if (!isCurrent() || get().ws || get().feedOriginBlocked) return;

          let ws;
          try {
            ws = new WebSocket(buildFeedWsUrl());
          } catch {
            set({ isConnected: false, feedError: 'Market feed unavailable. Check feed configuration.' });
            return;
          }
          const watchdog = setTimeout(() => {
            if (get().ws === ws && ws.readyState === 0) ws.close();
          }, 10000);
          let batchHandle;
          const pending = [];

          ws.onopen = () => {
            clearTimeout(watchdog);
            if (!isCurrent() || get().ws !== ws) {
              ws.close();
              return;
            }
            reconnectAttempt = 0;
            set({ isConnected: true, feedError: '' });
            ws.send(JSON.stringify({ type: 'subscribe', symbols: ['*'] }));
            get().syncAvailableSymbols();
          };

          ws.onmessage = (e) => {
            if (get().ws !== ws) return;
            try {
              const updates = extractMarketTicks(e.data);
              if (updates.length > 0) {
                // Keep tick order within the frame. Collapsing each symbol to
                // its final quote loses the direction of its last price move.
                updates.forEach((tick) => pending.push(tick));
                if (!batchHandle) {
                  batchHandle = scheduleTickBatch(() => {
                    batchHandle = null;
                    if (get().ws === ws) get().upsertSymbols(pending.splice(0));
                    else pending.length = 0;
                  });
                }
              }
            } catch (err) {
              console.error('[SymbolStore] WS parse error:', err);
            }
          };

          ws.onclose = () => {
            clearTimeout(watchdog);
            cancelTickBatch(batchHandle);
            batchHandle = null;
            pending.length = 0;
            if (get().ws !== ws) return;
            const shouldReconnect = isCurrent();
            const originBlocked = get().feedOriginBlocked;
            set((state) => ({
              isConnected: false,
              ws: null,
              feedError: originBlocked ? state.feedError :
                shouldReconnect ? 'Market feed reconnecting…' : 'Market feed disconnected.',
              symbols: Object.fromEntries(
                Object.entries(state.symbols).map(([key, value]) => [key, { ...value, live: false }])
              ),
            }));
            if (shouldReconnect && !originBlocked) {
              const reconnectTimer = setTimeout(connect, getFeedReconnectDelayMs(reconnectAttempt));
              reconnectAttempt += 1;
              set({ reconnectTimer });
            }
          };

          ws.onerror = () => {
            if (get().ws !== ws) return;
            // Browser error events do not expose the handshake reason. The
            // close handler owns the visible state and bounded retry.
            ws.close();
          };

          set({ ws });
        };

        const syncStatusAndOrigin = async () => {
          let allowedOrigins = null;
          try {
            allowedOrigins = await get().syncAvailableSymbols({ force: true });
          } catch {
            // An unavailable status endpoint must not prevent a valid socket.
          }
          if (!isCurrent()) return;

          const originError = getFeedOriginError(
            allowedOrigins,
            typeof window !== 'undefined' ? window.location?.origin : '',
            shouldUseFeedDevProxy()
          );
          if (originError) {
            set({ feedOriginBlocked: true, isConnected: false, feedError: originError });
            const currentSocket = get().ws;
            if (currentSocket && currentSocket.readyState !== WebSocket.CLOSING &&
              currentSocket.readyState !== WebSocket.CLOSED) currentSocket.close();
            return;
          }

          if (get().feedOriginBlocked) {
            set({ feedOriginBlocked: false, feedError: '' });
            connect();
          }
        };

        set({ statusPollTimer: setInterval(() => { void syncStatusAndOrigin(); }, STATUS_POLL_MS) });
        const initialStatus = syncStatusAndOrigin();
        if (shouldUseFeedDevProxy()) {
          // The proxy presents its own permitted Origin to the upstream feed.
          // Its status request must not delay a working WebSocket handshake.
          connect();
          return;
        }

        let preflightTimer;
        const preflightDeadline = new Promise((resolve) => {
          preflightTimer = setTimeout(resolve, 3000);
        });
        void Promise.race([initialStatus, preflightDeadline]).then(() => {
          clearTimeout(preflightTimer);
          if (isCurrent() && !get().feedOriginBlocked) connect();
        });
      },

      syncAvailableSymbols: ({ force = false } = {}) => {
        const current = get();
        if (current.statusSyncPromise) return current.statusSyncPromise;
        if (!force && Date.now() - current.lastStatusSyncAt < STATUS_SYNC_TTL_MS) return Promise.resolve();

        const statusGeneration = current.connectionGeneration;
        const statusBrokerScope = current.brokerScope;

        const syncPromise = (async () => {
          let statusUrl;
          try {
            statusUrl = buildFeedStatusUrl();
          } catch {
            return;
          }
          if (!statusUrl) return;

          try {
            // The feed status is public. Sending cookies makes the browser drop
            // the response from backends that omit Access-Control-Allow-Credentials,
            // which silently fell back to the full instrument list.
            const res = await fetch(statusUrl, { credentials: 'omit' });
            if (!res.ok) return null;
            const payload = await res.json();
            if (get().connectionGeneration !== statusGeneration ||
              get().brokerScope !== statusBrokerScope) return null;
            const allowedOrigins = Array.isArray(payload?.allowed_browser_origins)
              ? payload.allowed_browser_origins : null;
            const streamed = extractStreamedSymbols(payload);
            if (streamed.size === 0) return allowedOrigins;

            const statusRows = mapFeedStatusRows(payload);

            set((state) => {
              if (state.connectionGeneration !== statusGeneration ||
                state.brokerScope !== statusBrokerScope) return {};
              // The list is exactly the streamed symbols: symbols SuperAdmin
              // stopped streaming are removed, new ones are added.
              const unchanged = sameNames(state.feedSymbolNames, streamed)
                && Object.keys(state.symbols || {}).every((sym) => streamed.has(sym))
                && sameNames((state.symbolMetadata || []).map((entry) => entry.symbol), streamed);
              if (unchanged) return {};

              const nextSymbols = {};
              streamed.forEach((sym) => {
                const existing = state.symbols?.[sym];
                if (existing) {
                  nextSymbols[sym] = existing;
                  return;
                }
                const item = statusRows.get(sym) || {};
                nextSymbols[sym] = {
                  symbol: sym,
                  bid: validMarketPrice(item.bid) ? Number(item.bid).toFixed(5) : null,
                  ask: validMarketPrice(item.ask) ? Number(item.ask).toFixed(5) : null,
                  bidDir: null,
                  askDir: null,
                  dir: null,
                  live: Boolean(item.fresh && (item.bid || item.ask)),
                  lastUpdate: item.last_tick_ms || null,
                  category: getCategory(sym),
                };
              });

              const nextMetadata = Object.values(nextSymbols)
                .map((s) => ({ symbol: s.symbol, category: s.category || getCategory(s.symbol) }))
                .filter((s) => s.symbol)
                .sort((a, b) => a.symbol.localeCompare(b.symbol));

              return {
                symbols: nextSymbols,
                symbolMetadata: nextMetadata,
                feedSymbolNames: [...streamed],
              };
            });
            return allowedOrigins;
          } catch {
            // Ignore transient status fetch errors; cached symbols remain available.
            return null;
          }
        })().finally(() => {
          if (get().statusSyncPromise === syncPromise) set({ statusSyncPromise: null });
        });

        set({ statusSyncPromise: syncPromise, lastStatusSyncAt: Date.now() });
        return syncPromise;
      },

      disconnectWebSocket: () => {
        const { ws, reconnectTimer, statusPollTimer } = get();
        if (reconnectTimer) clearTimeout(reconnectTimer);
        if (statusPollTimer) clearInterval(statusPollTimer);

        set({
          connectionGeneration: get().connectionGeneration + 1,
          shouldReconnect: false,
          reconnectTimer: null,
          statusPollTimer: null,
          statusSyncPromise: null,
          feedOriginBlocked: false,
          isConnected: false,
          ws: null,
        });

        if (ws && typeof WebSocket !== 'undefined') {
          const connecting = WebSocket.CONNECTING ?? 0;
          const closing = WebSocket.CLOSING ?? 2;
          const closed = WebSocket.CLOSED ?? 3;
          if (ws.readyState === connecting) {
            // Closing mid-handshake makes the browser report a failed connection
            // (React StrictMode unmounts effects once in dev), so close on open.
            ws.onmessage = null;
            ws.onopen = () => ws.close(1000, 'Symbol feed disabled');
          } else if (ws.readyState !== closing && ws.readyState !== closed) {
            ws.close(1000, 'Symbol feed disabled');
          }
        }
      },

      syncMetadata: () => {
        set((state) => {
          if (state.symbolMetadata.length > 0 || Object.keys(state.symbols).length === 0) return {};
          return {
            symbolMetadata: Object.values(state.symbols)
              .map((s) => ({ symbol: s.symbol, category: s.category || getCategory(s.symbol) }))
              .filter((s) => s.symbol)
              .sort((a, b) => a.symbol.localeCompare(b.symbol)),
          };
        });
      },

      getSymbolsByCategory: (category) => {
        return Object.values(get().symbols)
          .filter((s) => s.category === category)
          .sort((a, b) => a.symbol.localeCompare(b.symbol));
      },

      getGroupCounts: () => {
        const counts = {};
        Object.values(CATEGORIES).forEach((c) => (counts[c] = 0));
        Object.values(get().symbols).forEach((s) => {
          counts[s.category] = (counts[s.category] || 0) + 1;
        });
        return counts;
      },
    }),
    {
      name: getSymbolPersistKey(),
      storage: symbolPersistStorage,
      version: 1,
      partialize: (state) => ({
        symbolMetadata: state.symbolMetadata,
      }),
      migrate: (persistedState) => {
        const existingMetadata = Array.isArray(persistedState?.symbolMetadata)
          ? persistedState.symbolMetadata
          : [];
        if (existingMetadata.length > 0) return { symbolMetadata: existingMetadata };

        const symbolMetadata = Object.values(persistedState?.symbols || {})
          .map((entry) => ({
            symbol: String(entry?.symbol || '').trim().toUpperCase(),
            category: entry?.category || getCategory(entry?.symbol),
          }))
          .filter((entry) => entry.symbol)
          .sort((a, b) => a.symbol.localeCompare(b.symbol));
        return { symbolMetadata };
      },
    }
  )
);

export default useSymbolStore;
