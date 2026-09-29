const normalizeOrigin = (value) => {
  try {
    return new URL(value).origin.toLowerCase();
  } catch {
    return '';
  }
};

export const getFeedOriginError = (allowedOrigins, currentOrigin, useDevProxy = false) => {
  if (useDevProxy || !Array.isArray(allowedOrigins) || !currentOrigin) return '';

  const origin = normalizeOrigin(currentOrigin);
  if (!origin || allowedOrigins.some((allowed) => allowed === '*' || normalizeOrigin(allowed) === origin)) {
    return '';
  }

  return `Market feed blocked for ${origin}. Add this address to the feed server's allowed browser origins.`;
};

export const getFeedReconnectDelayMs = (attempt) =>
  Math.min(1000 * (2 ** Math.min(Math.max(0, attempt), 5)), 30000);
