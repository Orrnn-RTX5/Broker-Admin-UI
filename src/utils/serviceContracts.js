const firstValue = (...values) =>
  values.find((value) => value !== undefined && value !== null && value !== '') ?? null;

const requireSymbol = (value) => {
  const symbol = String(value ?? '').trim();
  if (!symbol) throw new Error('symbol is required');
  return symbol;
};

export const buildCloseAllRequest = (filters = {}) => {
  const source = typeof filters === 'string' ? { symbol: filters } : (filters || {});
  const symbol = requireSymbol(firstValue(source.symbol, source.Symbol));

  return {
    method: 'post',
    url: '/api/v2/admin/close-all',
    data: { symbol },
  };
};

export const buildInstrumentToggleRequest = (symbol, enabled) => ({
  method: 'patch',
  url: `/api/v2/admin/instruments/${encodeURIComponent(requireSymbol(symbol))}/toggle`,
  data: typeof enabled === 'boolean' ? { enabled } : undefined,
});

export const buildDisconnectRequest = (token) => ({
  method: 'get',
  url: '/Disconnect',
  config: {
    params: { id: token },
    _noRetry: true,
    _preserveAuthQuery: true,
  },
});
