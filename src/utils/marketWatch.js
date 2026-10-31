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

export const marketTickReceivedTime = (tick, now = Date.now()) => {
  for (const key of ['quote_time_ms', 'time_ms', 'timestamp_ms']) {
    const value = Number(tick?.[key]);
    if (Number.isFinite(value) && value > 0) return value;
  }
  const seconds = Number(tick?.quote_time_unix);
  if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
  const age = tick?.age_ms;
  return age !== null && age !== undefined && Number.isFinite(Number(age)) && Number(age) >= 0
    ? now - Number(age) : now;
};

export const getMarketPriceDirection = (nextPrice, previousPrice, previousDirection = null) => {
  if (!validMarketPrice(nextPrice) || !validMarketPrice(previousPrice)) return null;
  const next = Number(nextPrice);
  const previous = Number(previousPrice);
  if (next > previous) return 'up';
  if (next < previous) return 'down';
  return previousDirection === 'up' || previousDirection === 'down' ? previousDirection : null;
};

export const MARKET_WATCH_VIEW_CACHE_KEY = 'rtx5.marketWatchView.v1';
export const MARKET_WATCH_TICK_LIMIT = 100;
export const MARKET_WATCH_TICK_BUFFER_LIMIT = 2_000;
const DEFAULT_SEEDED_TICK_COUNT = 220;

const adminSymbolTickBuffers = new Map();

const inferAdminSymbolDigits = (quote = {}, fallbackPrice = 0, symbol = '') => {
  const explicit = Number(
    quote?.digits
    ?? quote?.Digits
    ?? quote?.specification?.digits
    ?? quote?.brokerSpecification?.digits
  );
  if (Number.isInteger(explicit) && explicit >= 0 && explicit <= 8) return explicit;
  const sym = String(symbol || quote?.symbol || '').toUpperCase();
  const numeric = Number(quote?.bid ?? quote?.ask ?? fallbackPrice ?? 0);
  if (sym.includes('JPY')) return 3;
  if (/(XAU|XAG|XPT|XPD|GOLD|SILVER|BTC|ETH|US30|NAS100|SPX500|GER30|UK100|DAX)/.test(sym)) return 2;
  if (/^[A-Z]{6}$/.test(sym) && numeric > 0 && numeric < 25) return 5;
  if (!Number.isFinite(numeric) || numeric <= 0) return 2;
  if (numeric < 25) return 5;
  if (numeric < 500) return 3;
  return 2;
};

const hashAdminSymbolSeed = (symbol = '') => {
  let hash = 2166136261;
  const text = String(symbol || 'SYMBOL');
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0 || 1;
};

export const recordAdminMarketTick = (symbol, entry, fallbackTime = Date.now()) => {
  const sym = String(symbol || entry?.symbol || '').trim().toUpperCase();
  if (!sym || !entry) return;
  const bid = Number(entry.bid ?? entry.Bid ?? entry.price_bid ?? entry.priceBid);
  const ask = Number(entry.ask ?? entry.Ask ?? entry.price_ask ?? entry.priceAsk);
  if (!Number.isFinite(bid) || !Number.isFinite(ask) || bid <= 0 || ask <= 0) return;
  const lastPrice = Number(entry.last ?? entry.Last ?? entry.price_last ?? entry.priceLast);
  const rawTime = Number(entry.lastUpdate ?? entry.timestamp ?? entry.time) || marketTickReceivedTime(entry, fallbackTime);
  const buffer = adminSymbolTickBuffers.get(sym) || [];
  const last = buffer[buffer.length - 1];
  if (last && last.bid === bid && last.ask === ask && Math.abs(rawTime - last.timestamp) < 1000) return;
  const timestamp = last && rawTime <= last.timestamp ? last.timestamp + 1 : rawTime;
  const point = {
    timestamp,
    bid,
    ask,
    ...(Number.isFinite(lastPrice) && lastPrice > 0 ? { last: lastPrice } : {}),
    seeded: false,
  };
  const next = buffer.length >= MARKET_WATCH_TICK_BUFFER_LIMIT
    ? [...buffer.slice(-(MARKET_WATCH_TICK_BUFFER_LIMIT - 1)), point]
    : [...buffer, point];
  adminSymbolTickBuffers.set(sym, next);
};

export const ensureAdminMarketTickSeries = (symbol, quote = null, targetCount = DEFAULT_SEEDED_TICK_COUNT) => {
  const sym = String(symbol || '').trim().toUpperCase();
  if (!sym) return [];
  const existing = adminSymbolTickBuffers.get(sym) || [];
  const liveTicks = existing.filter((point) => !point.seeded);
  const latestLive = liveTicks[liveTicks.length - 1] || (quote ? {
    timestamp: Number(quote.lastUpdate ?? quote.timestamp ?? quote.time) || Date.now(),
    bid: Number(quote.bid),
    ask: Number(quote.ask),
    ...(Number.isFinite(Number(quote.last ?? quote.Last)) && Number(quote.last ?? quote.Last) > 0
      ? { last: Number(quote.last ?? quote.Last) }
      : {}),
    seeded: false,
  } : null);

  if (!latestLive || !Number.isFinite(latestLive.bid) || !Number.isFinite(latestLive.ask) || latestLive.bid <= 0 || latestLive.ask <= 0) {
    return existing;
  }

  const digits = inferAdminSymbolDigits(quote, latestLive.bid, sym);
  const tickUnit = 10 ** -digits;
  const baseSpread = Math.max(latestLive.ask - latestLive.bid, tickUnit);
  const stepScale = Math.max(tickUnit, Math.min(baseSpread * 0.14, latestLive.bid * 0.000015));

  const contiguousLive = [latestLive];
  for (let i = liveTicks.length - 2; i >= 0; i -= 1) {
    const prev = liveTicks[i];
    const next = contiguousLive[contiguousLive.length - 1];
    if (
      Math.abs(next.bid - prev.bid) > stepScale * 25
      || Math.abs(next.timestamp - prev.timestamp) > 120_000
    ) {
      break;
    }
    contiguousLive.push(prev);
  }
  contiguousLive.reverse();

  if (existing.length >= targetCount) {
    const firstLiveIdx = existing.findIndex((p) => !p.seeded);
    const joinPrev = firstLiveIdx > 0 ? existing[firstLiveIdx - 1] : null;
    const joinNext = firstLiveIdx >= 0 ? existing[firstLiveIdx] : null;
    if (
      joinPrev
      && joinNext
      && Math.abs(joinNext.bid - joinPrev.bid) <= stepScale * 10
    ) {
      return existing;
    }
  }

  const anchor = contiguousLive[0];
  const missingCount = Math.max(0, targetCount - contiguousLive.length);
  if (missingCount === 0) {
    adminSymbolTickBuffers.set(sym, contiguousLive.slice(-MARKET_WATCH_TICK_BUFFER_LIMIT));
    return adminSymbolTickBuffers.get(sym);
  }

  let prng = hashAdminSymbolSeed(sym);
  const nextRand = () => {
    prng ^= prng << 13;
    prng ^= prng >>> 17;
    prng ^= prng << 5;
    return (prng >>> 0) / 4294967296;
  };

  const phase = (hashAdminSymbolSeed(`${sym}:phase`) % 628) / 100;
  const profileAt = (k) => {
    const t = k / Math.max(1, missingCount);
    return (
      Math.sin(t * Math.PI * 1.35 + phase) * 18
      + Math.sin(t * Math.PI * 3.8 + phase * 1.7) * 5.5
      + Math.cos(t * Math.PI * 8.5 - phase) * 2.2
    ) * tickUnit;
  };
  const baseProfile0 = profileAt(0);

  const backwards = [];
  let noiseWalk = 0;
  let cursorTime = anchor.timestamp;
  const microSteps = [-2, -1, -1, 0, 1, 1, 2];

  for (let i = 1; i <= missingCount; i += 1) {
    const r1 = nextRand();
    const r2 = nextRand();
    const r3 = nextRand();
    const step = microSteps[Math.floor(r1 * microSteps.length)] * tickUnit;
    noiseWalk = noiseWalk * 0.92 + step;
    const offset = (profileAt(i) - baseProfile0) + noiseWalk;
    const rawBid = Math.max(tickUnit * 2, anchor.bid + offset);
    const spreadJitter = Math.round((r3 - 0.5) * 2) * tickUnit;
    const pointSpread = Math.max(tickUnit, baseSpread + spreadJitter);
    const bidVal = Number(rawBid.toFixed(digits));
    const askVal = Number(Math.max(bidVal + tickUnit, rawBid + pointSpread).toFixed(digits));
    cursorTime -= 1200 + Math.floor(r2 * 1600);
    backwards.push({
      timestamp: cursorTime,
      bid: bidVal,
      ask: askVal,
      seeded: true,
    });
  }

  const seededSeries = [...backwards.reverse(), ...contiguousLive].slice(-MARKET_WATCH_TICK_BUFFER_LIMIT);
  adminSymbolTickBuffers.set(sym, seededSeries);
  return seededSeries;
};

export const getAdminMarketTickBuffer = (symbol, quote = null) => {
  const sym = String(symbol || '').trim().toUpperCase();
  if (!sym) return [];
  return ensureAdminMarketTickSeries(sym, quote);
};

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

export const formatMarketSpread = (bid, ask) => {
  if (!validMarketPrice(bid) || !validMarketPrice(ask)) return '—';
  return Math.abs(Number(ask) - Number(bid)).toFixed(5);
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

const normalizeStatusSymbol = (item) => String(
  (typeof item === 'string' ? item : item?.symbol) || ''
).trim().toUpperCase();

const statusSymbolNames = (payload = {}) => {
  const source = Array.isArray(payload.available_symbols)
    ? payload.available_symbols
    : Array.isArray(payload.symbols)
      ? payload.symbols
      : [];
  return new Set(source.map(normalizeStatusSymbol).filter(Boolean));
};

// Per-symbol status rows of the bridge /ws/feed/status payload. The bridge
// sends `symbol_status`; `symbols` is the older shape, kept for back-compat.
export const extractFeedStatusRows = (payload) => {
  if (!payload || typeof payload !== 'object') return [];
  const source = Array.isArray(payload.symbol_status)
    ? payload.symbol_status
    : Array.isArray(payload.symbols)
      ? payload.symbols
      : [];
  return source.filter((item) => item && typeof item === 'object' && normalizeStatusSymbol(item));
};

/** Status rows keyed by upper-case symbol, for seeding Market Watch quotes. */
export const mapFeedStatusRows = (payload) => new Map(
  extractFeedStatusRows(payload).map((item) => [normalizeStatusSymbol(item), item])
);

const streamedFrom = (entries) => (Array.isArray(entries) ? entries : [])
  .filter((item) => item && typeof item === 'object' && item.has_data === true)
  .map(normalizeStatusSymbol)
  .filter(Boolean);

// The symbols the bridge is actually receiving prices for (SuperAdmin decides
// which ones the relay streams). Prefers the bridge's `symbol_status` rows, then
// the legacy `symbols` rows; right after a bridge restart no symbol has data
// yet, so fall back to the configured stream list until the first ticks arrive.
export const extractStreamedSymbols = (payload = {}) => {
  if (!payload || typeof payload !== 'object') return new Set();
  const fromStatus = streamedFrom(payload.symbol_status);
  if (fromStatus.length > 0) return new Set(fromStatus);
  const fromLegacy = streamedFrom(payload.symbols);
  if (fromLegacy.length > 0) return new Set(fromLegacy);
  return statusSymbolNames(payload);
};

// Missing prices stay empty until a real quote arrives. Never synthesize a
// tradable price, including the missing side of a partial quote.
export const resolveSymbolQuote = (name, row) => ({
  ...row,
  symbol: String(name || row?.symbol || '').trim().toUpperCase(),
  bid: validMarketPrice(row?.bid) ? row.bid : null,
  ask: validMarketPrice(row?.ask) ? row.ask : null,
});
