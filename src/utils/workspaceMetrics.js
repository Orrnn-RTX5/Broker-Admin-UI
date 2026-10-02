const field = (row, keys) => keys.map(key => row?.[key]).find(value => value !== undefined && value !== null && value !== '');
export const finiteValue = (value) => value !== '' && value != null && Number.isFinite(Number(value)) ? Number(value) : null;
export const workspaceAccount = (row) => ({
  login: field(row, ['login', 'Login', 'id']),
  group: String(field(row, ['group', 'Group', 'group_name']) || ''),
  equity: finiteValue(field(row, ['equity', 'Equity'])),
  balance: finiteValue(field(row, ['balance', 'Balance'])),
  margin: finiteValue(field(row, ['margin', 'Margin'])),
  currency: String(field(row, ['currency', 'Currency']) || '').toUpperCase(),
});
export const workspacePosition = (row) => {
  const action = field(row, ['action', 'Action', 'type', 'Type', 'side']);
  const side = String(action ?? '').toLowerCase();
  const ext = finiteValue(field(row, ['volumeExt', 'VolumeExt', 'volume_ext']));
  return {
    ticket: field(row, ['positionTicket', 'position', 'Position', 'ticket', 'Ticket', 'id']),
    login: field(row, ['login', 'Login', 'account_login']),
    symbol: String(field(row, ['symbol', 'Symbol']) || '—'),
    side: action === 0 || side === '0' || side.includes('buy') ? 'BUY' : action === 1 || side === '1' || side.includes('sell') ? 'SELL' : String(action || '—'),
    lots: finiteValue(row?.lots) ?? (ext !== null ? ext / 10000 : finiteValue(field(row, ['volume', 'Volume']))),
    open: finiteValue(field(row, ['priceOpen', 'PriceOpen', 'price_open', 'open_price'])),
    current: finiteValue(field(row, ['priceCurrent', 'PriceCurrent', 'price_current', 'current_price'])),
    sl: finiteValue(field(row, ['priceSl', 'priceSL', 'PriceSL', 'sl', 'SL'])),
    tp: finiteValue(field(row, ['priceTp', 'priceTP', 'PriceTP', 'tp', 'TP'])),
    profit: finiteValue(field(row, ['profit', 'Profit'])),
    comment: String(field(row, ['comment', 'Comment']) || ''),
  };
};

// Keep currencies separate: brokerage books can contain several currencies.
export const buildWorkspaceMetrics = (accounts, positions) => {
  const normalized = accounts.map(workspaceAccount);
  const currencies = [...new Set(normalized.map(row => row.currency).filter(Boolean))];
  const completeCurrency = normalized.length > 0 && normalized.every(row => row.currency) && currencies.length === 1;
  const total = key => completeCurrency && normalized.every(row => row[key] !== null) ? normalized.reduce((sum, row) => sum + row[key], 0) : null;
  const knownGroups = normalized.every(row => row.group);
  const demo = normalized.filter(row => /demo/i.test(row.group)).length;
  const bySymbol = new Map();
  positions.map(workspacePosition).forEach(row => {
    const current = bySymbol.get(row.symbol) || { symbol: row.symbol, positions: 0, buy: 0, sell: 0 };
    current.positions += 1;
    if (row.side === 'BUY') current.buy = current.buy === null || row.lots === null ? null : current.buy + row.lots;
    if (row.side === 'SELL') current.sell = current.sell === null || row.lots === null ? null : current.sell + row.lots;
    bySymbol.set(row.symbol, current);
  });
  return { real: knownGroups ? normalized.length - demo : null, demo: knownGroups ? demo : null,
    currency: completeCurrency ? currencies[0] : null, currencies, equity: total('equity'), balance: total('balance'), margin: total('margin'),
    symbols: [...bySymbol.values()].sort((a, b) => b.positions - a.positions), accounts: normalized.length, positions: positions.length };
};
