export const DEV_PROXY_BACKEND_COOKIE = 'rtx5_dev_backend';
export const DEV_PROXY_EXT_COOKIE = 'rtx5_dev_ext_backend';
export const DEV_PROXY_DIRECT_MANAGER_COOKIE = 'rtx5_dev_direct_manager';

export const isLocalWebHostname = (hostname = '') => {
  const host = String(hostname || '')
    .replace(/^\[|\]$/g, '')
    .toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
};

export const parseDevProxyTarget = (value = '', fallback = '') => {
  const raw = String(value || '').trim();
  if (!raw) return fallback;

  try {
    const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
    const url = new URL(candidate);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return fallback;
    return url.origin;
  } catch {
    return fallback;
  }
};

export const readCookieValue = (cookieHeader = '', name = '') => {
  if (!cookieHeader || !name) return '';

  for (const part of String(cookieHeader).split(';')) {
    const trimmed = part.trim();
    const separator = trimmed.indexOf('=');
    if (separator <= 0) continue;
    if (trimmed.slice(0, separator) !== name) continue;

    const raw = trimmed.slice(separator + 1);
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }

  return '';
};

export const stripDevProxyCookies = (cookieHeader = '') =>
  String(cookieHeader || '')
    .split(';')
    .map((part) => part.trim())
    .filter((part) => {
      const key = part.split('=')[0];
      return key && ![DEV_PROXY_BACKEND_COOKIE, DEV_PROXY_EXT_COOKIE, DEV_PROXY_DIRECT_MANAGER_COOKIE].includes(key);
    })
    .join('; ');
