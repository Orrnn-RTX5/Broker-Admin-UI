export const extractMarketTicks = (raw) => {
  const ticks = [];
  const visit = value => {
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (!value || typeof value !== 'object') return;
    if (typeof value.symbol === 'string' && value.symbol.trim() && (value.bid !== undefined || value.ask !== undefined)) {
      ticks.push(value);
      return;
    }
    for (const key of ['ticks', 'data', 'quotes', 'symbols']) if (Array.isArray(value[key])) value[key].forEach(visit);
  };
  if (typeof raw !== 'string') { visit(raw); return ticks; }
  try { visit(JSON.parse(raw)); } catch {
    for (const line of raw.split('\n')) {
      try { visit(JSON.parse(line)); } catch { /* Ignore non-quote messages. */ }
    }
  }
  return ticks;
};

export const validMarketPrice = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) && Number(value) > 0;

export const MARKET_WATCH_VIEW_CACHE_KEY = 'rtx5.marketWatchView.v1';
export const MARKET_WATCH_TICK_LIMIT = 100;

const MARKET_WATCH_TABS = new Set(['Symbols', 'Details', 'Ticks']);

const resolveStorage = (storage) => {
  if (storage) return storage;
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
};

const getMarketWatchViewCacheKey = (scope) => {
  const normalizedScope = String(scope || '').trim();
  return normalizedScope
    ? `${MARKET_WATCH_VIEW_CACHE_KEY}:${encodeURIComponent(normalizedScope)}`
    : MARKET_WATCH_VIEW_CACHE_KEY;
};

export const seedMarketTickHistory = (symbol, quote, history = []) => {
  const normalizedSymbol = String(symbol || '').trim().toUpperCase();
  if (!normalizedSymbol) return [];

  const matchingHistory = (Array.isArray(history) ? history : [])
    .filter((tick) => String(tick?.symbol || '').trim().toUpperCase() === normalizedSymbol)
    .slice(0, MARKET_WATCH_TICK_LIMIT);

  if (
    !quote?.lastUpdate ||
    (!validMarketPrice(quote.bid) && !validMarketPrice(quote.ask))
  ) {
    return matchingHistory;
  }

  const normalizedQuote = { ...quote, symbol: normalizedSymbol };
  const isAlreadyFirst = matchingHistory[0]?.lastUpdate === normalizedQuote.lastUpdate &&
    matchingHistory[0]?.bid === normalizedQuote.bid &&
    matchingHistory[0]?.ask === normalizedQuote.ask;

  if (isAlreadyFirst) return matchingHistory;
  return [normalizedQuote, ...matchingHistory].slice(0, MARKET_WATCH_TICK_LIMIT);
};

export const readMarketWatchViewCache = (storage, scope = '') => {
  const fallback = { selected: '', tab: 'Symbols', history: [] };
  try {
    const target = resolveStorage(storage);
    const parsed = JSON.parse(target?.getItem(getMarketWatchViewCacheKey(scope)) || 'null');
    if (!parsed || typeof parsed !== 'object') return fallback;

    const selected = String(parsed.selected || '').trim().toUpperCase();
    const tab = MARKET_WATCH_TABS.has(parsed.tab) ? parsed.tab : 'Symbols';
    const history = seedMarketTickHistory(selected, null, parsed.history);
    return { selected, tab: selected ? tab : 'Symbols', history };
  } catch {
    return fallback;
  }
};

export const writeMarketWatchViewCache = (view, storage, scope = '') => {
  try {
    const target = resolveStorage(storage);
    if (!target) return false;
    const selected = String(view?.selected || '').trim().toUpperCase();
    const tab = MARKET_WATCH_TABS.has(view?.tab) ? view.tab : 'Symbols';
    const history = seedMarketTickHistory(selected, null, view?.history);
    target.setItem(getMarketWatchViewCacheKey(scope), JSON.stringify({ selected, tab, history }));
    return true;
  } catch {
    return false;
  }
};

export const formatMarketPrice = value => {
  if (!validMarketPrice(value)) return '—';
  const num = Number(value);
  if (num >= 1000) return num.toFixed(2);
  if (num >= 50) return num.toFixed(3);
  return num.toFixed(5);
};


export const isMarketQuoteFresh = (quote, connected, now = Date.now()) => Boolean(connected && quote?.live && quote.lastUpdate && now - quote.lastUpdate < 30000);

export const getSymbolFriendlyDescription = (symbol) => {
  if (!symbol) return '';
  const sym = String(symbol).toUpperCase();
  if (sym === 'EURUSD') return 'Euro vs US Dollar';
  if (sym === 'GBPUSD') return 'Great British Pound vs US Dollar';
  if (sym === 'USDJPY') return 'US Dollar vs Japanese Yen';
  if (sym === 'USDCHF') return 'US Dollar vs Swiss Franc';
  if (sym === 'AUDUSD') return 'Australian Dollar vs US Dollar';
  if (sym === 'USDCAD') return 'US Dollar vs Canadian Dollar';
  if (sym === 'NZDUSD') return 'New Zealand Dollar vs US Dollar';
  if (sym === 'EURGBP') return 'Euro vs British Pound';
  if (sym === 'EURJPY') return 'Euro vs Japanese Yen';
  if (sym === 'GBPJPY') return 'British Pound vs Japanese Yen';
  if (sym === 'XAUUSD' || sym === 'GOLD') return 'Gold (Troy Ounce) vs US Dollar';
  if (sym === 'XAGUSD' || sym === 'SILVER') return 'Silver vs US Dollar';
  if (sym === 'XPTUSD') return 'Platinum vs US Dollar';
  if (sym === 'XPDUSD') return 'Palladium vs US Dollar';
  if (sym.startsWith('BTC')) return 'Bitcoin vs US Dollar';
  if (sym.startsWith('ETH')) return 'Ethereum vs US Dollar';
  if (sym.startsWith('SOL')) return 'Solana vs US Dollar';
  if (sym.startsWith('XRP')) return 'Ripple vs US Dollar';
  if (sym.startsWith('DOGE')) return 'Dogecoin vs US Dollar';
  if (sym.includes('.GB')) {
    const base = sym.replace('.GB', '');
    if (base === 'AAL') return 'Anglo American PLC (London Stock Exchange)';
    if (base === 'AAF') return 'Airtel Africa PLC (London Stock Exchange)';
    if (base === '8TRAD') return '800 Trading Group (LSE)';
    return `${base} · LSE Equity`;
  }
  if (sym.includes('.DE')) {
    const base = sym.replace('.DE', '');
    return `${base} · Deutsche Börse XETRA Equity`;
  }
  if (sym.includes('.US') || sym.includes('-24')) {
    const base = sym.replace('.US', '').replace('-24', '');
    return `${base} · US Equity (NASDAQ / NYSE)`;
  }
  if (sym.includes('.CH')) {
    const base = sym.replace('.CH', '');
    return `${base} · SIX Swiss Exchange Equity`;
  }
  if (sym.includes('US30') || sym.includes('WS30')) return 'Wall Street 30 (Dow Jones Industrial)';
  if (sym.includes('NAS100')) return 'US Tech 100 (NASDAQ)';
  if (sym.includes('SPX500')) return 'S&P 500 Index';
  if (sym.includes('GER30') || sym.includes('GER40') || sym.includes('DAX')) return 'Germany 40 Index (DAX)';
  if (sym.includes('UK100')) return 'UK 100 Index (FTSE)';
  if (sym.includes('OIL') || sym.includes('BRENT')) return 'Brent Crude Oil Spot';
  if (sym.includes('WTI')) return 'WTI Crude Oil Spot';
  if (sym.includes('GAS')) return 'Natural Gas Spot';

  return `${symbol} · Financial Contract`;
};

const statusSymbolNames = (payload = {}) => {
  const source = Array.isArray(payload.available_symbols)
    ? payload.available_symbols
    : Array.isArray(payload.symbols)
      ? payload.symbols
      : [];
  return new Set(
    source
      .map((item) => String((typeof item === 'string' ? item : item?.symbol) || '').trim().toUpperCase())
      .filter(Boolean)
  );
};

// The symbols the bridge is actually receiving prices for (SuperAdmin decides
// which ones the relay streams). Right after a bridge restart no symbol has data
// yet, so fall back to the configured stream list until the first ticks arrive.
export const extractStreamedSymbols = (payload = {}) => {
  const entries = Array.isArray(payload?.symbols) ? payload.symbols : [];
  const streamed = entries
    .filter((item) => item && typeof item === 'object' && item.has_data === true)
    .map((item) => String(item.symbol || '').trim().toUpperCase())
    .filter(Boolean);
  return streamed.length > 0 ? new Set(streamed) : statusSymbolNames(payload || {});
};
