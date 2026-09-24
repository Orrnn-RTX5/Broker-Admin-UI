import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { buildFeedWsUrl, buildFeedStatusUrl } from '../config/endpoints';
import { extractMarketTicks, extractStreamedSymbols, validMarketPrice } from '../utils/marketWatch';
import { createBrowserDeferredPersistStorage } from './deferredPersistStorage';

const STATUS_SYNC_TTL_MS = 10000;
// Re-read the streamed symbol inventory so SuperAdmin changes appear without a reload.
const STATUS_POLL_MS = 15000;
const FEED_RECONNECT_DELAY_MS = 500;
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
      shouldReconnect: false,
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
            const prevBid = prev && validMarketPrice(prev.bid) ? Number(prev.bid) : null;

            let dir = 'up';
            if (numBid !== null && prevBid !== null) {
              if (numBid < prevBid) dir = 'down';
              else if (numBid > prevBid) dir = 'up';
              else dir = prev.dir || 'up';
            }

            nextSymbols[sym] = {
              ...(prev || {}),
              symbol: sym,
              bid: validMarketPrice(bid) ? Number(bid).toFixed(5) : (prev?.bid || null),
              ask: validMarketPrice(ask) ? Number(ask).toFixed(5) : (prev?.ask || null),
              dir,
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

        const existingTimer = get().reconnectTimer;
        if (existingTimer) clearTimeout(existingTimer);
        set((state) => ({
          shouldReconnect: true,
          reconnectTimer: null,
          feedError: '',
          symbols: Object.fromEntries(
            Object.entries(state.symbols).map(([key, value]) => [key, { ...value, live: false }])
          ),
        }));

        // Eagerly prefetch symbols from status endpoint while socket establishes
        get().syncAvailableSymbols();
        if (!get().statusPollTimer) {
          set({ statusPollTimer: setInterval(() => get().syncAvailableSymbols({ force: true }), STATUS_POLL_MS) });
        }

        const connect = () => {
          if (!get().shouldReconnect) return;

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
          const pending = new Map();

          ws.onopen = () => {
            clearTimeout(watchdog);
            if (get().ws !== ws) {
              ws.close();
              return;
            }
            set({ isConnected: true, feedError: '' });
            ws.send(JSON.stringify({ type: 'subscribe', symbols: ['*'] }));
            get().syncAvailableSymbols();
          };

          ws.onmessage = (e) => {
            if (get().ws !== ws) return;
            try {
              const updates = extractMarketTicks(e.data);
              if (updates.length > 0) {
                updates.forEach((tick) =>
                  pending.set(tick.symbol, { ...pending.get(tick.symbol), ...tick })
                );
                if (!batchHandle) {
                  batchHandle = scheduleTickBatch(() => {
                    batchHandle = null;
                    if (get().ws === ws) get().upsertSymbols([...pending.values()]);
                    pending.clear();
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
            pending.clear();
            if (get().ws !== ws) return;
            const shouldReconnect = get().shouldReconnect;
            set((state) => ({
              isConnected: false,
              ws: null,
              feedError: shouldReconnect ? 'Market feed reconnecting…' : 'Market feed disconnected.',
              symbols: Object.fromEntries(
                Object.entries(state.symbols).map(([key, value]) => [key, { ...value, live: false }])
              ),
            }));
            if (shouldReconnect) {
              const reconnectTimer = setTimeout(connect, FEED_RECONNECT_DELAY_MS);
              set({ reconnectTimer });
            }
          };

          ws.onerror = (err) => {
            console.error('[SymbolStore] WS error:', err);
            ws.close();
          };

          set({ ws });
        };

        connect();
      },

      syncAvailableSymbols: ({ force = false } = {}) => {
        const current = get();
        if (current.statusSyncPromise) return current.statusSyncPromise;
        if (!force && Date.now() - current.lastStatusSyncAt < STATUS_SYNC_TTL_MS) return Promise.resolve();

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
            if (!res.ok) return;
            const payload = await res.json();
            const streamed = extractStreamedSymbols(payload);
            if (streamed.size === 0) return;

            const statusRows = new Map(
              (Array.isArray(payload.symbols) ? payload.symbols : [])
                .filter((item) => item && typeof item === 'object')
                .map((item) => [String(item.symbol || '').trim().toUpperCase(), item])
            );

            set((state) => {
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
                  dir: 'up',
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
          } catch {
            // Ignore transient status fetch errors; cached symbols remain available.
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
          shouldReconnect: false,
          reconnectTimer: null,
          statusPollTimer: null,
          isConnected: false,
          ws: null,
        });

        if (ws && typeof WebSocket !== 'undefined') {
          const closing = WebSocket.CLOSING ?? 2;
          const closed = WebSocket.CLOSED ?? 3;
          if (ws.readyState !== closing && ws.readyState !== closed) {
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
