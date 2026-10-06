import { inferMarketCategory } from './marketCatalogue.js';

// The group picker uses the selected feed's eligible instrument catalogue.
// Existing group assignments are loaded separately so they remain visible.
export const normalizeGroupFeedSymbols = (response) => {
  const rows = Array.isArray(response) ? response : response?.symbols;
  if (!Array.isArray(rows)) return [];
  const seen = new Set();
  return rows.flatMap((row) => {
    const symbol = String(typeof row === 'string' ? row : row?.symbol ?? '').trim().toUpperCase();
    if (!symbol || seen.has(symbol)) return [];
    seen.add(symbol);
    return [{ symbol, configured: true, category: row?.category || inferMarketCategory(symbol) }];
  }).sort((a, b) => a.symbol.localeCompare(b.symbol));
};

export const findGroupFeedSymbol = (symbols, input) => (
  symbols.find((item) => item.symbol === String(input ?? '').trim().toUpperCase()) || null
);
