export const numericInstrumentFields = ['digits', 'contract_size', 'tick_size', 'tick_value', 'spread', 'margin_rate', 'min_volume', 'max_volume', 'volume_step'];
export const calcModes = ['forex', 'cfd_leverage', 'cfd_no_leverage', 'futures'];
export const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const cryptoSessions = () => dayNames.map((_, day_of_week) => ({day_of_week, quote_from: '00:00', quote_to: '24:00', trade_from: '00:00', trade_to: '24:00'}));
export const instrumentCategories = ['Crypto', 'Forex', 'Metals', 'Indices', 'Stocks', 'Futures'];
const categoryKey = value => String(value || '').trim().toLowerCase();
const supplied = value => value !== undefined && value !== null && value !== '';
// Editable starter configurations, not verified specifications for an instrument.
const starters = {
  Crypto: {digits: 2, contract_size: 1, tick_size: 0.01, tick_value: 0.01, calc_mode: 'cfd_leverage'},
  Forex: {digits: 5, contract_size: 100000, tick_size: 0.00001, tick_value: 1, calc_mode: 'forex'},
  Metals: {digits: 2, contract_size: 100, tick_size: 0.01, tick_value: 1, calc_mode: 'cfd_leverage'},
  Indices: {digits: 2, contract_size: 1, tick_size: 0.01, tick_value: 0.01, calc_mode: 'cfd_leverage'},
  Stocks: {digits: 2, contract_size: 1, tick_size: 0.01, tick_value: 0.01, calc_mode: 'cfd_no_leverage'},
  Futures: {digits: 2, contract_size: 1, tick_size: 0.01, tick_value: 0.01, calc_mode: 'futures', min_volume: 1, volume_step: 1},
};
export function defaultCategory(source = {}, instruments = []) {
  const symbol = String(source.symbol || '').trim().toUpperCase();
  const configured = instruments.find(row => String(row.symbol || '').toUpperCase() === symbol);
  const category = String(source.category || configured?.category || '').trim();
  if (category) return instrumentCategories.find(name => categoryKey(name) === categoryKey(category)) || category;
  // Recognize known bases with optional broker suffixes (.pro, _raw, -ecn).
  // Unknown names stay unclassified instead of guessing a contract type.
  const base = symbol.split(/[._-]/)[0];
  const currencies = new Set(['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD', 'CNH', 'CNY', 'HKD', 'SGD', 'NOK', 'SEK', 'DKK', 'ZAR', 'MXN', 'TRY', 'PLN', 'CZK', 'HUF', 'ILS', 'THB']);
  const quote = base.slice(-3);
  if (/^(XAU|XAG|XPT|XPD)/.test(base) && currencies.has(quote) && base.length === 6) return 'Metals';
  if (['GOLD', 'SILVER', 'PLATINUM', 'PALLADIUM'].includes(base)) return 'Metals';
  if (/^(BTC|ETH|SOL|LTC|XRP|BCH|ADA|DOGE|DOT|AVAX|LINK|BNB)(USD|USDT|EUR|GBP|BTC|ETH)$/.test(base)) return 'Crypto';
  if (base.length === 6 && currencies.has(base.slice(0, 3)) && currencies.has(quote) && base.slice(0, 3) !== quote) return 'Forex';
  if (['US30', 'US500', 'SPX500', 'NAS100', 'USTEC', 'US100', 'UK100', 'GER40', 'DE40', 'DAX40', 'FRA40', 'JP225', 'JPN225', 'HK50', 'AUS200', 'EU50'].includes(base)) return 'Indices';
  return '';
}
export function categoryTemplate(category, instruments = [], symbol = '') {
  if (!categoryKey(category)) return null;
  const canonical = instrumentCategories.find(name => categoryKey(name) === categoryKey(category));
  const matches = instruments.filter(row => categoryKey(row.category) === categoryKey(category));
  const preferred = {Crypto: 'BTCUSD', Forex: 'EURUSD', Metals: 'XAUUSD'}[canonical];
  const broker = matches.find(row => row.symbol === symbol)
    || matches.find(row => row.symbol === preferred) || matches[0];
  if (!canonical && !broker) return null;
  const starter = canonical ? {
    spread: 0, margin_rate: 1, min_volume: 0.01, max_volume: 100, volume_step: 0.01,
    margin_currency: 'USD', profit_currency: 'USD', symbol_timezone: 'UTC',
    sessions: canonical === 'Crypto' ? cryptoSessions() : cryptoSessions().filter(row => row.day_of_week > 0 && row.day_of_week < 6),
    ...starters[canonical],
  } : {};
  const brokerValues = Object.fromEntries(Object.entries(broker || {}).filter(([, value]) => supplied(value)));
  return {values: {...starter, ...brokerValues}, label: broker ? `broker ${category} defaults (${broker.symbol}; starter fallback for missing fields)` : `${canonical} starter defaults`};
}
export function applyCategoryTemplate(form, category, template, source = {}) {
  const next = {...form, category, enabled: false};
  const values = template?.values || {};
  for (const key of [...numericInstrumentFields, 'calc_mode', 'margin_currency', 'profit_currency', 'symbol_timezone']) {
    next[key] = supplied(source[key]) ? source[key] : supplied(values[key]) ? values[key] : key === 'symbol_timezone' ? 'UTC' : '';
  }
  const sessions = Array.isArray(source.sessions) && source.sessions.length ? source.sessions : values.sessions || [];
  next.sessions = instrumentForm({sessions}).sessions;
  return next;
}
export const usesCryptoDefaults = ({symbol, category}) => category
  ? /crypto/i.test(category)
  : ['BTCUSD', 'ETHUSD', 'SOLUSD'].includes(symbol);
export function applyCryptoTemplate(form, template, source = {}) {
  const next = {...form, category: 'Crypto', enabled: false};
  for (const key of [...numericInstrumentFields, 'calc_mode', 'margin_currency', 'profit_currency']) {
    const authoritative = source[key];
    const value = authoritative !== undefined && authoritative !== null && authoritative !== '' ? authoritative : template[key];
    if (value !== undefined && value !== null && value !== '') next[key] = value;
  }
  next.sessions = form.sessions.length ? form.sessions : cryptoSessions();
  return next;
}
export function instrumentForm(source = {}) {
  source = source ?? {};
  const form = {symbol: '', description: '', category: '', symbol_timezone: 'UTC', calc_mode: '', margin_currency: '', profit_currency: '', enabled: false, sessions: [], ...Object.fromEntries(numericInstrumentFields.map(key => [key, '']))};
  for (const key of Object.keys(form)) if (source[key] !== undefined && source[key] !== null) form[key] = source[key];
  form.sessions = form.sessions.map(session => ({...session, ...Object.fromEntries(['quote', 'trade'].flatMap(kind => {
    // Existing schedules inherit trading hours when both quote boundaries are
    // absent. Display that same effective schedule for administrator review.
    const inherited = kind === 'quote' && session.quote_from == null && session.quote_to == null;
    const from = String(session[`${inherited ? 'trade' : kind}_from`] || '').slice(0, 5);
    const to = String(session[`${inherited ? 'trade' : kind}_to`] || '').slice(0, 5);
    return [[`${kind}_from`, from], [`${kind}_to`, to === '00:00' && from === '00:00' ? '24:00' : to]];
  }))}));
  return form;
}
export function instrumentPayload(form) {
  const payload = instrumentForm(form);
  payload.symbol = payload.symbol.trim();
  if (!/^[A-Z0-9][A-Z0-9._-]{0,19}$/.test(payload.symbol)) throw new Error('Use the exact feed symbol: up to 20 uppercase letters, numbers, dots, underscores or hyphens.');
  for (const key of numericInstrumentFields) {
    if (payload[key] === '' || !Number.isFinite(Number(payload[key]))) throw new Error(`${key.replaceAll('_', ' ')} is required; use the broker or LP specification.`);
    payload[key] = Number(payload[key]);
    const zeroAllowed = ['digits', 'spread', 'margin_rate'].includes(key);
    if (payload[key] < 0 || (!zeroAllowed && payload[key] === 0)) throw new Error(`${key.replaceAll('_', ' ')} is outside its allowed range.`);
  }
  if (!Number.isInteger(payload.digits) || payload.digits > 12 || !Number.isInteger(payload.spread)) throw new Error('Digits and spread must be whole numbers; digits must be at most 12.');
  if (payload.min_volume > payload.max_volume) throw new Error('Minimum volume cannot exceed maximum volume.');
  for (const key of ['min_volume', 'max_volume']) {
    const ratio = payload[key] / payload.volume_step;
    if (Math.abs(ratio - Math.round(ratio)) > 1e-7 * Math.max(1, Math.abs(ratio))) throw new Error('Volume limits must align with the volume step.');
  }
  if (!calcModes.includes(payload.calc_mode)) throw new Error('Select a supported calculation mode.');
  for (const key of ['category', 'symbol_timezone', 'margin_currency', 'profit_currency']) {
    payload[key] = payload[key].trim();
    if (!payload[key]) throw new Error(`${key.replaceAll('_', ' ')} is required.`);
  }
  try { new Intl.DateTimeFormat('en', {timeZone: payload.symbol_timezone}); } catch { throw new Error('Enter a valid timezone, such as UTC or America/New_York.'); }
  if (!payload.sessions.length) throw new Error('Configure at least one quote and trading session.');
  const time = value => /^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/.test(value);
  const seenDays = new Set();
  const windows = {quote: [], trade: []};
  const minute = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
  for (const session of payload.sessions) {
    if (!Number.isInteger(session.day_of_week) || session.day_of_week < 0 || session.day_of_week > 6) throw new Error('Invalid session day.');
    if (seenDays.has(session.day_of_week)) throw new Error('Use one session per day.');
    seenDays.add(session.day_of_week);
    const ranges = {};
    for (const kind of ['quote', 'trade']) {
      const from = session[`${kind}_from`], to = session[`${kind}_to`];
      if (!time(from) || !time(to) || from === '24:00') throw new Error('Session times must use HH:MM; 24:00 is only valid as an end.');
      const start = minute(from);
      let end = minute(to);
      if (end <= start) end += 1440;
      ranges[kind] = [start, end];
      windows[kind].push([session.day_of_week * 1440 + start, session.day_of_week * 1440 + end]);
    }
    let [tradeStart, tradeEnd] = ranges.trade;
    if (tradeStart < ranges.quote[0]) {tradeStart += 1440; tradeEnd += 1440;}
    if (tradeStart < ranges.quote[0] || tradeEnd > ranges.quote[1]) throw new Error('Trading hours must fit inside quote hours.');
  }
  for (const ranges of Object.values(windows)) for (let i = 0; i < ranges.length; i++) for (let j = i + 1; j < ranges.length; j++) {
    for (const offset of [-10080, 0, 10080]) if (ranges[i][0] < ranges[j][1] + offset && ranges[j][0] + offset < ranges[i][1]) throw new Error('Sessions must not overlap, including across the end of the week.');
  }
  return payload;
}
