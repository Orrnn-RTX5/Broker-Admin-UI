const required = (value, label) => {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(`${label} is required`);
  return text;
};
const number = (value, label, fallback = 0) => {
  const result = Number(value ?? fallback);
  if (!Number.isFinite(result) || result < 0) throw new Error(`${label} must be a non-negative number`);
  return result;
};
export function categoryPayload(body) {
  const result = {...body};
  if (body.parentId !== undefined && body.parentId !== '') {
    result.parentId = number(body.parentId, 'Parent category');
    if (!Number.isSafeInteger(result.parentId) || result.parentId < 1) throw new Error('Invalid parent category');
  } else delete result.parentId;
  return result;
}
export function sessionPayload(rows) {
  return rows.filter(row => [row.quoteStart, row.quoteEnd, row.tradeStart, row.tradeEnd,
    row.quote_from, row.quote_to, row.trade_from, row.trade_to].some(Boolean)).map(row => {
    const result = {day_of_week: Number(row.day_of_week)};
    if (!Number.isInteger(result.day_of_week) || result.day_of_week < 0 || result.day_of_week > 6) throw new Error('Invalid session day');
    for (const [field, alias] of Object.entries({quote_from:'quoteStart',quote_to:'quoteEnd',trade_from:'tradeStart',trade_to:'tradeEnd'})) {
      const time = String(row[alias] ?? row[field] ?? '').trim();
      if (!/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$|^24:00(?::00)?$/.test(time)) throw new Error('Complete all four session times using HH:MM (24:00 is allowed). Remove empty intervals for closed days.');
      if (time.startsWith('24:') && field.endsWith('_from')) throw new Error('24:00 is only valid as an end time');
      // The trading engine represents end-of-day as midnight, including
      // equal start/end times for a full-day interval.
      result[field] = time.startsWith('24:') ? '00:00' : time;
    }
    return result;
  });
}
export function commissionPayload(body) {
  const min = number(body.min_volume, 'Minimum volume');
  const max = number(body.max_volume, 'Maximum volume', 999999);
  if (max !== 0 && max < min) throw new Error('Maximum volume must be at least minimum volume');
  return {name: required(body.name, 'Name'), symbol: required(body.symbol, 'Symbol'),
    commission_type: body.commissionType ?? body.commission_type ?? 'per_lot',
    value: number(body.value, 'Commission'), min_volume: min, max_volume: max};
}
export function leveragePayload(body) {
  const from = number(body.volumeFrom ?? body.volume_from, 'Volume from');
  const to = number(body.volumeTo ?? body.volume_to, 'Volume to');
  const leverage = number(body.leverage, 'Leverage');
  if (!Number.isInteger(leverage) || leverage < 1 || leverage > 10000) throw new Error('Leverage must be an integer from 1 to 10000');
  if (to !== 0 && to <= from) throw new Error('Volume to must exceed volume from (0 means unlimited)');
  return {symbol: required(body.symbol, 'Symbol'), volume_from: from, volume_to: to, leverage};
}
export function swapFreePayload(body) {
  const days = number(body.max_holding_days, 'Maximum holding days');
  if (!Number.isInteger(days)) throw new Error('Maximum holding days must be a whole number');
  return {group_name: required(body.group_name, 'Group'), symbol_pattern: required(body.symbol_pattern, 'Symbol pattern'),
    swap_free: Boolean(body.swap_free), charge_fee: Boolean(body.charge_fee),
    fee_per_lot: number(body.fee_per_lot, 'Fee per lot'), max_holding_days: days};
}
export function depthPayload(body) {
  const levels = number(body.depth_levels, 'Depth levels');
  const markup = number(body.spread_markup, 'Spread markup');
  if (!Number.isInteger(levels) || levels < 1 || levels > 50) throw new Error('Depth levels must be an integer from 1 to 50');
  if (!Number.isInteger(markup)) throw new Error('Spread markup must be a whole number');
  return {symbol: required(body.symbol, 'Symbol'), depth_levels: levels, spread_markup: markup,
    volume_filter: number(body.volume_filter, 'Volume filter'), aggregation: required(body.aggregation, 'Aggregation'), enabled: Boolean(body.enabled)};
}
export function visibilityPayload(body) {
  if (!Array.isArray(body.symbols)) throw new Error('A complete symbol list is required');
  return {group: required(body.group, 'Group'), symbols: [...new Set(body.symbols.map(value => required(value, 'Symbol')))]};
}
