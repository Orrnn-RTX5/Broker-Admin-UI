import {inferMarketCategory} from './marketCatalogue.js';

export function rootCategory(category, folders) {
  const visited = new Set();
  let current = category;
  while (current?.parentKey && !visited.has(current.key)) {
    visited.add(current.key);
    const parent = folders.find(row => row.key === current.parentKey);
    if (!parent) break;
    current = parent;
  }
  return current;
}

export function categoryCandidates(category, folders, instruments) {
  const root = rootCategory(category, folders);
  const same = (a,b) => String(a || '').toLowerCase() === String(b || '').toLowerCase();
  const assetTypes = ['Forex','Crypto','Metals','Indices','Stocks','Futures','Bonds','Commodities','Others'];
  const typed = assetTypes.some(name => same(name,root.name));
  return instruments.filter(row => {
    const owner = folders.find(folder => folder.symbols.some(item => item.symbol === row.symbol));
    return !typed || same(inferMarketCategory(row.symbol),root.name) || rootCategory(owner,folders)?.key === root.key;
  }).map(row => ({...row,
    alreadyAssigned: category.symbols.some(item => item.symbol === row.symbol),
    needsSetup: row.configurationStatus === 'Setup required',
  })).sort((a,b) => a.symbol.localeCompare(b.symbol));
}

export async function assignCategorySymbols(category, candidates, selected, update) {
  const rows = [...new Set(selected)].map(symbol => {
    const row = candidates.find(item => item.symbol === symbol);
    if (!row || row.needsSetup || row.alreadyAssigned) throw new Error(`${symbol} is not available for assignment`);
    return row;
  });
  const saved = [], failed = [];
  for (const row of rows) {
    try {
      await update(row.symbol, {category:category.name});
      saved.push(row.symbol);
    } catch (error) {failed.push({symbol:row.symbol, message:error.message || 'Assignment failed'});}
  }
  return {saved, failed};
}
