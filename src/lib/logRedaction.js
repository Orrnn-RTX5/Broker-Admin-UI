const SECRET_KEY_RE = /(authorization|password|token|secret|api[_-]?key|session|licen[cs]e[_-]?(key|secret))/i;
const URL_SECRET_PARAM_RE = /^(id|token|access_token|refresh_token|session|session_token|auth|authorization|jwt|licen[cs]e[_-]?(key|secret))$/i;
const BEARER_VALUE_RE = /\bBearer\s+[-._~+/=A-Za-z0-9]+/gi;
const SECRET_QUERY_RE = /([?&](?:id|token|access_token|refresh_token|session|session_token|auth|authorization|jwt|licen[cs]e[_-]?(?:key|secret))=)[^&#\s]+/gi;

const redactStringForLog = (value = '') =>
  String(value)
    .replace(BEARER_VALUE_RE, 'Bearer [REDACTED]')
    .replace(SECRET_QUERY_RE, '$1[REDACTED]');

export const redactUrlForLog = (value = '') => {
  const raw = String(value || '');
  if (!raw) return raw;

  try {
    const isAbsolute = /^[a-z][a-z\d+.-]*:\/\//i.test(raw);
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const parsed = new URL(raw, base);

    parsed.searchParams.forEach((_, key) => {
      if (URL_SECRET_PARAM_RE.test(key)) {
        parsed.searchParams.set(key, '[REDACTED]');
      }
    });

    return isAbsolute
      ? redactStringForLog(parsed.toString())
      : redactStringForLog(`${parsed.pathname}${parsed.search}${parsed.hash}`);
  } catch {
    return redactStringForLog(raw);
  }
};

export const redactForLog = (value, seen = new WeakSet()) => {
  if (typeof value === 'string') return redactStringForLog(value);
  if (!value || typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';

  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactStringForLog(value.message),
      stack: value.stack ? redactStringForLog(value.stack) : undefined,
    };
  }

  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactForLog(item, seen));
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      SECRET_KEY_RE.test(key) ? '[REDACTED]' : redactForLog(entry, seen),
    ])
  );
};
