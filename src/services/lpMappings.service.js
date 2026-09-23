import apiClient from './apiClient';

const query = (params = {}) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.append(key, String(value));
  });
  const qs = search.toString();
  return qs ? `?${qs}` : '';
};

// ─── LP Symbol Mapping (External LP Symbol → Internal RTX5 Symbol) ───────────
// All data is real backend data: lp_config + market_data_symbol_registry +
// instruments + live Redis ticks. No dummy data.
export const LpMappingsService = {
  list: (params = {}) =>
    apiClient.get(`/LpMappingList${query(params)}`),

  get: (id) =>
    apiClient.get(`/LpMappingGet${query({ id })}`),

  create: (body) =>
    apiClient.post('/LpMappingCreate', body),

  update: (body) =>
    apiClient.post('/LpMappingUpdate', body),

  setEnabled: (id, enabled) =>
    apiClient.post('/LpMappingSetEnabled', { id, enabled }),

  remove: (id) =>
    apiClient.post('/LpMappingDelete', { id }),

  test: (body) =>
    apiClient.post('/LpMappingTest', body),

  lps: () =>
    apiClient.get('/LpMappingLPs'),

  lpSymbols: (lpName, params = {}) =>
    apiClient.get(`/LpMappingLPSymbols${query({ lp_name: lpName, ...params })}`),

  internalSymbols: (params = {}) =>
    apiClient.get(`/LpMappingInternalSymbols${query(params)}`),

  // Latest live ticks for symbols (same source as Market Watch).
  ticks: (symbols = []) => {
    if (!symbols.length) return Promise.resolve([]);
    const qs = symbols.map((s) => `symbols[]=${encodeURIComponent(s)}`).join('&');
    return apiClient.get(`/TickLast?${qs}`);
  },
};

export const buildMappingPayload = (form) => {
  const payload = {
    lp_name: form.lpName,
    lp_symbol: form.lpSymbol,
    internal_symbol: form.internalSymbol,
    feed_role: form.feedRole,
    priority: Number(form.priority),
    status: form.status,
    price_multiplier: Number(form.priceMultiplier),
    contract_multiplier: Number(form.contractMultiplier),
    bid_adjustment: Number(form.bidAdjustment),
    ask_adjustment: Number(form.askAdjustment),
    invert_price: Boolean(form.invertPrice),
  };
  if (form.digitsOverride === '' || form.digitsOverride === null || form.digitsOverride === undefined) {
    payload.digits_override_null = true;
  } else {
    payload.digits_override = Number(form.digitsOverride);
  }
  return payload;
};
