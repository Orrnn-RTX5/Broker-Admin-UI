export const getRuntimeConfig = () => {
  if (typeof window === 'undefined') return {};
  return window.__RTX5_RUNTIME_CONFIG__ || {};
};

export const getRuntimeValue = (...keys) => {
  const config = getRuntimeConfig();

  for (const key of keys) {
    const value = config[key];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }

  return undefined;
};

export {
  formatBrokerConnectionStatus,
  getBrokerBranding,
  getBrokerMonogram,
  readStoredBrokerInfo,
  resolveBrokerLogoUrl,
} from '../utils/branding.js';

