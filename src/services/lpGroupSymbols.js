// Group permissions are a source for an explicit routing scope, not proof of LP readiness.
export async function loadRoutingGroupSymbols(selector, fetchGroup) {
  const excluded = new Set(selector?.exclude || []);
  const groups = [...new Set(selector?.include || [])].filter(name => !excluded.has(name));
  if (!groups.length) return { symbols: [], groups, message: 'Enter an included group to load its allowed symbols.' };
  const records = await Promise.all(groups.map(async name => {
    const record = await fetchGroup(name);
    if (record?.group !== name || !Array.isArray(record.symbols) || !Array.isArray(record.blocked) || typeof record.unrestricted !== 'boolean') {
      throw new Error('The group symbol list is unavailable. Refresh and try again.');
    }
    return record;
  }));
  if (records.some(record => record.unrestricted)) {
    return { symbols: [], groups, message: 'A selected group allows all broker symbols. Enter an explicit symbol list for this rule.' };
  }
  const symbols = new Set();
  for (const record of records) {
    const blocked = new Set(record.blocked);
    for (const row of record.symbols) {
      if (typeof row.symbol !== 'string' || !row.symbol.trim() || row.symbol !== row.symbol.trim() || row.symbol === '*' || typeof row.trade_allowed !== 'boolean') {
        throw new Error('The group symbol list is invalid. Refresh and try again.');
      }
      if (row.trade_allowed && !blocked.has(row.symbol)) symbols.add(row.symbol);
    }
  }
  return { symbols: [...symbols], groups, message: symbols.size ? '' : 'No trading-enabled symbols are allowed by the selected groups.' };
}
