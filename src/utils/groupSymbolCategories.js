import { parseCsvList } from './adminValidation.js';
import { symbolCategoryOptions } from './groupProperties.js';

const marketNames = ['Forex', 'Crypto', 'Metals', 'Indices', 'Commodities', 'Stocks', 'Bonds', 'Futures', 'Others'];

export const buildGroupSymbolCategories = (entries = [], value = '') => {
  const names = new Map();
  const normalized = entries.map(entry => {
    const parts = String(entry.category || 'Others').split(/[\\/]+/).map(part => part.trim()).filter(Boolean);
    const name = parts.map(part => marketNames.find(market => market.toLowerCase() === part.toLowerCase()) || part).join('/') || 'Others';
    const key = name.toLowerCase();
    if (!names.has(key)) names.set(key, name);
    return { ...entry, category: names.get(key) };
  });
  return symbolCategoryOptions(normalized, parseCsvList(value)).map(option => ({
    ...option,
    label: option.category.replaceAll('/', ' / '),
    selectedCount: option.symbols.length - option.addable,
  }));
};

export const toggleGroupSymbolCategory = (value, category) => {
  const current = parseCsvList(value);
  const listed = new Set(current.map(symbol => symbol.toUpperCase()));
  const members = category.symbols.map(entry => entry.symbol);
  if (members.length && members.every(symbol => listed.has(symbol.toUpperCase()))) {
    const removing = new Set(members.map(symbol => symbol.toUpperCase()));
    return current.filter(symbol => !removing.has(symbol.toUpperCase())).join(', ');
  }
  for (const symbol of members) {
    if (!listed.has(symbol.toUpperCase())) { current.push(symbol); listed.add(symbol.toUpperCase()); }
  }
  return current.join(', ');
};
