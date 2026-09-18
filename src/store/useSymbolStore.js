import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { buildFeedWsUrl } from '../config/endpoints';
import { extractMarketTicks, validMarketPrice } from '../utils/marketWatch';

const CATEGORIES = {
  METALS: 'Metals',
  FOREX: 'Forex',
  INDICES: 'Indices',
  CRYPTO: 'Crypto',
  COMMODITIES: 'Commodities',
  OTHERS: 'Others',
};

const getCategory = (symbol) => {
  const sym = symbol.toUpperCase();
  
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

const buildFeedStatusUrl = () => {
  const wsUrl = buildFeedWsUrl();
  try {
    const url = new URL(wsUrl, typeof window !== 'undefined' ? window.location.href : 'http://localhost');
    url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
    url.pathname = `${url.pathname.replace(/\/$/, '')}/status`;
    url.hash = '';
    return url.toString();
  } catch {
    return '';
  }
};

const extractStatusSymbols = (payload = {}) => {
  const source = Array.isArray(payload.available_symbols)
    ? payload.available_symbols
    : Array.isArray(payload.symbols)
      ? payload.symbols
      : [];
  return new Set(source.map((symbol) => String(symbol || '').trim().toUpperCase()).filter(Boolean));
};

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

      upsertSymbols: (dataArray) => {
        set((state) => {
          const nextSymbols = { ...state.symbols };
          const now = Date.now();
          let metadataUpdated = false;

          dataArray.forEach(data => {
            const { symbol, bid, ask } = data;
            if (!symbol || (!validMarketPrice(bid) && !validMarketPrice(ask))) return;
            if (!nextSymbols[symbol]) metadataUpdated = true;
            
            const category = getCategory(symbol);
            nextSymbols[symbol] = {
              ...(nextSymbols[symbol] || {}),
              symbol,
              bid: validMarketPrice(bid) ? Number(bid).toFixed(5) : (nextSymbols[symbol]?.bid || null),
              ask: validMarketPrice(ask) ? Number(ask).toFixed(5) : (nextSymbols[symbol]?.ask || null),
              dir: validMarketPrice(bid) && validMarketPrice(nextSymbols[symbol]?.bid) && Number(bid) < Number(nextSymbols[symbol].bid) ? 'down' : 'up',
              live: true,
              lastUpdate: now,
              category,
            };
          });

          const nextState = { symbols: nextSymbols };
          
          // Recompute metadata if it's empty or a new symbol was added
          if (metadataUpdated || (state.symbolMetadata && state.symbolMetadata.length === 0 && Object.keys(nextSymbols).length > 0)) {
            nextState.symbolMetadata = Object.values(nextSymbols)
              .map(s => ({ symbol: s.symbol, category: s.category || getCategory(s.symbol) }))
              .filter(s => s.symbol)
              .sort((a, b) => a.symbol.localeCompare(b.symbol));
          }

          return nextState;
        });
      },

      initWebSocket: () => {
        if (get().ws) return;

        const existingTimer = get().reconnectTimer;
        if (existingTimer) clearTimeout(existingTimer);
        set(state => ({ shouldReconnect: true, reconnectTimer: null, feedError: '', symbols: Object.fromEntries(Object.entries(state.symbols).map(([key, value]) => [key, { ...value, live: false }])) }));

        const connect = () => {
          if (!get().shouldReconnect) return;

          let ws;
          try { ws = new WebSocket(buildFeedWsUrl()); } catch {
            set({ isConnected: false, feedError: 'Market feed unavailable. Check the feed configuration.' });
            return;
          }
          const watchdog = setTimeout(() => { if (get().ws === ws && ws.readyState === 0) ws.close(); }, 10000);
          let batchTimer;
          const pending = new Map();
          
          ws.onopen = () => {
            clearTimeout(watchdog);
            if (get().ws !== ws) { ws.close(); return; }
            console.log('[SymbolStore] Connected to WebSocket');
            set({ isConnected: true, feedError: '' });
            ws.send(JSON.stringify({ type: 'subscribe', symbols: ["*"] }));
            get().syncAvailableSymbols();
          };

          ws.onmessage = (e) => {
            if (get().ws !== ws) return;
            try {
              const updates = extractMarketTicks(e.data);
              if (updates.length > 0) {
                updates.forEach(tick => pending.set(tick.symbol, { ...pending.get(tick.symbol), ...tick }));
                if (!batchTimer) batchTimer = setTimeout(() => {
                  batchTimer = null;
                  if (get().ws === ws) get().upsertSymbols([...pending.values()]);
                  pending.clear();
                }, 100);
              }
            } catch (err) {
              console.error('[SymbolStore] WS parse error:', err);
            }
          };

          ws.onclose = () => {
            clearTimeout(watchdog);
            clearTimeout(batchTimer);
            pending.clear();
            if (get().ws !== ws) return;
            const shouldReconnect = get().shouldReconnect;
            console.log(shouldReconnect ? '[SymbolStore] Disconnected. Reconnecting...' : '[SymbolStore] Disconnected.');
            set(state => ({ isConnected: false, ws: null, feedError: 'Market feed unavailable. Reconnecting…', symbols: Object.fromEntries(Object.entries(state.symbols).map(([key, value]) => [key, { ...value, live: false }])) }));
            if (shouldReconnect) {
              const reconnectTimer = setTimeout(connect, 5000);
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

      syncAvailableSymbols: async () => {
        const sourceSocket = get().ws;
        let statusUrl;
        try {
          statusUrl = buildFeedStatusUrl();
        } catch {
          return;
        }
        if (!statusUrl) return;

        try {
          const res = await fetch(statusUrl, { credentials: 'include' });
          if (!res.ok) return;
          const payload = await res.json();
          if (get().ws !== sourceSocket || !get().shouldReconnect) return;
          const allowed = extractStatusSymbols(payload);
          if (allowed.size === 0) return;

          set((state) => {
            const nextSymbols = Object.entries(state.symbols || {}).reduce((acc, [key, entry]) => {
              if (allowed.has(String(entry?.symbol || key).trim().toUpperCase())) acc[key] = entry;
              return acc;
            }, {});
            return {
              symbols: nextSymbols,
              symbolMetadata: (state.symbolMetadata || []).filter((entry) => (
                allowed.has(String(entry.symbol || '').trim().toUpperCase())
              )),
            };
          });
        } catch {
          // Keep current cache if scoped status is temporarily unavailable.
        }
      },

      disconnectWebSocket: () => {
        const { ws, reconnectTimer } = get();
        if (reconnectTimer) clearTimeout(reconnectTimer);

        set({
          shouldReconnect: false,
          reconnectTimer: null,
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
              .map(s => ({ symbol: s.symbol, category: s.category || getCategory(s.symbol) }))
              .filter(s => s.symbol)
              .sort((a, b) => a.symbol.localeCompare(b.symbol))
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
        Object.values(CATEGORIES).forEach(c => counts[c] = 0);
        Object.values(get().symbols).forEach(s => {
          counts[s.category] = (counts[s.category] || 0) + 1;
        });
        return counts;
      }
    }),
    {
      name: 'rtx-symbols-storage',
      partialize: (state) => ({ 
        symbols: state.symbols,
        symbolMetadata: state.symbolMetadata 
      }),
    }
  )
);

export default useSymbolStore;
