const normalizeAppPath = (value = '') => {
  const path = String(value || '').trim() || '/';
  return path.startsWith('/') ? path : `/${path}`;
};
export const shouldUseHashRouting = (location = window.location) => location.protocol === 'file:';

export const readAppPath = (location = window.location) => {
  if (shouldUseHashRouting(location)) {
    return normalizeAppPath(String(location.hash || '').replace(/^#/, ''));
  }

  return normalizeAppPath(location.pathname || '/');
};

export const buildNavigationTarget = (to, location = window.location) => {
  const path = normalizeAppPath(to);
  return shouldUseHashRouting(location) ? `#${path}` : path;
};
