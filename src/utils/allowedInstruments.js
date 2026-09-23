import { buildMarketCatalogue } from './marketCatalogue.js';
import { normalizeArrayResponse } from './apiShapes.js';

export function allowedInstruments(catalogue, configured, {page = 1, limit = 50, search = ''} = {}) {
  const configs = new Map(normalizeArrayResponse(configured).map(row => [String(row.symbol || row.Symbol || '').trim().toUpperCase(), row]));
  const query = String(search).trim().toLowerCase();
  const rows = buildMarketCatalogue(catalogue, configured).map(entry => {
    const configuration = configs.get(entry.symbol);
    return {
      ...configuration, ...entry,
      configuration: configuration || null,
      configurationStatus: configuration ? 'Configured' : 'Setup required',
      tradingMode: !configuration ? 'Unavailable - setup required'
        : configuration.enabled === false ? 'Disabled'
          : String(configuration.trade_mode || configuration.type || 'Enabled - subject to trading rules'),
    };
  }).filter(row => !query || [row.symbol, row.category, row.description, row.configurationStatus].some(value => String(value || '').toLowerCase().includes(query)));
  const safePage = Math.max(1, Number(page) || 1), safeLimit = Math.max(1, Number(limit) || 50);
  return {data: rows.slice((safePage - 1) * safeLimit, safePage * safeLimit), total: rows.length, page: safePage, limit: safeLimit};
}
