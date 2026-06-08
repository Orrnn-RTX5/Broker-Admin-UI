const DEFAULT_ARRAY_KEYS = [
  'data',
  'answer',
  'items',
  'results',
  'rows',
  'users',
  'accounts',
  'instruments',
  'symbols',
  'deposits',
  'withdrawals',
  'requests',
];

export const normalizeArrayResponse = (response, keys = DEFAULT_ARRAY_KEYS) => {
  if (Array.isArray(response)) return response;
  if (!response || typeof response !== 'object') return [];

  for (const key of keys) {
    const value = response[key];
    if (Array.isArray(value)) return value;
  }

  return [];
};

export const getApiErrorMessage = (error, fallback = 'Request failed') => {
  const data = error?.response?.data;
  if (typeof data === 'string' && data.trim()) return data.trim();
  if (data?.message) return data.message;
  if (data?.error?.message) return data.error.message;
  if (data?.error) return String(data.error);
  if (data?.code) return String(data.code);
  if (error?.message) return error.message;
  return fallback;
};
