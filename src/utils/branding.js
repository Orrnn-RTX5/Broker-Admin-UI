import { getRuntimeValue } from '../config/runtimeConfig.js';

const viteEnv = (typeof import.meta !== 'undefined' && import.meta.env) || {};

const trimTrailingSlash = (value = '') => String(value || '').replace(/\/+$/, '');

const firstNonEmpty = (...values) => {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return '';
};

export const readStoredBrokerInfo = () => {
  const readFrom = (storageName) => {
    try {
      const storage = typeof globalThis !== 'undefined' ? globalThis[storageName] : null;
      if (!storage?.getItem) return null;
      const raw = storage.getItem('broker_info');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  return readFrom('sessionStorage') || readFrom('localStorage') || null;
};

export const getBrokerMonogram = (name = '') => {
  const cleaned = String(name || '').trim();
  if (!cleaned) return 'BA';

  const parts = cleaned
    .split(/[\s._-]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase() || 'BA';
  }

  return cleaned.slice(0, 2).toUpperCase() || 'BA';
};

const PLACEHOLDER_LOGO_URLS = new Set([
  '/assets/logo.png',
  'assets/logo.png',
  '/logo-full-light.webp',
  'logo-full-light.webp',
]);

const PLACEHOLDER_SUPPORT_EMAILS = new Set([
  'support@rtx5.local',
  'support@orrnn.com',
]);

const isUsableLogoUrl = (value) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return false;
  return !PLACEHOLDER_LOGO_URLS.has(trimmed.toLowerCase());
};

const isUsableSupportEmail = (value) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return false;
  return !PLACEHOLDER_SUPPORT_EMAILS.has(trimmed.toLowerCase());
};

const isUsableFaviconUrl = (value) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return false;
  return !PLACEHOLDER_LOGO_URLS.has(trimmed.toLowerCase());
};

export const resolveBrokerFaviconUrl = (brokerOverride = null) => {
  const stored = readStoredBrokerInfo() || {};
  const broker = brokerOverride && typeof brokerOverride === 'object'
    ? { ...stored, ...brokerOverride }
    : stored;

  const explicitFavicon = [
    broker.favicon_url,
    broker.faviconUrl,
    broker.favicon,
    getRuntimeValue('FAVICON_URL', 'VITE_FAVICON_URL', 'BROKER_FAVICON_URL', 'VITE_BROKER_FAVICON_URL'),
    viteEnv.VITE_FAVICON_URL,
    viteEnv.VITE_BROKER_FAVICON_URL,
  ]
    .map((val) => String(val || '').trim())
    .find(isUsableFaviconUrl);

  if (explicitFavicon) return explicitFavicon;

  return resolveBrokerLogoUrl(broker) || '';
};

export const resolveBrokerLogoUrl = (brokerOverride = null) => {
  const stored = readStoredBrokerInfo() || {};
  const broker = brokerOverride && typeof brokerOverride === 'object'
    ? { ...stored, ...brokerOverride }
    : stored;

  const explicitLogo = [
    broker.logo_url,
    broker.logoUrl,
    getRuntimeValue('LOGO_URL', 'VITE_LOGO_URL', 'BROKER_LOGO_URL', 'VITE_BROKER_LOGO_URL'),
    viteEnv.VITE_LOGO_URL,
    viteEnv.VITE_BROKER_LOGO_URL,
  ]
    .map((val) => String(val || '').trim())
    .find(isUsableLogoUrl);

  if (explicitLogo) return explicitLogo;

  const brokerId = firstNonEmpty(
    broker.broker_id,
    broker.brokerId,
    broker.id,
    getRuntimeValue('BROKER_ID', 'VITE_BROKER_ID'),
    viteEnv.VITE_BROKER_ID
  );
  if (!brokerId) return '';

  const discoveryBase = trimTrailingSlash(
    firstNonEmpty(
      getRuntimeValue(
        'DISCOVERY_BASE_URL',
        'VITE_DISCOVERY_BASE_URL',
        'DEFAULT_DISCOVERY_BASE_URL',
        'VITE_DEFAULT_DISCOVERY_BASE_URL',
        'SUPER_ADMIN_API_HOST',
        'VITE_SUPER_ADMIN_API_HOST'
      ),
      viteEnv.VITE_DISCOVERY_BASE_URL,
      viteEnv.VITE_DEFAULT_DISCOVERY_BASE_URL,
      viteEnv.VITE_SUPER_ADMIN_API_HOST
    )
  );

  const logoPath = `/api/v1/brokers/${encodeURIComponent(brokerId)}/logo`;
  return discoveryBase ? `${discoveryBase}${logoPath}` : logoPath;
};

const humanizeBrokerId = (brokerId = '') => {
  const cleaned = String(brokerId || '').trim();
  if (!cleaned) return '';
  return cleaned
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const getBrokerBranding = (brokerOverride = null) => {
  const stored = readStoredBrokerInfo() || {};
  const broker = brokerOverride && typeof brokerOverride === 'object'
    ? { ...stored, ...brokerOverride }
    : stored;

  const brokerId = firstNonEmpty(
    broker.broker_id,
    broker.brokerId,
    broker.id,
    getRuntimeValue('BROKER_ID', 'VITE_BROKER_ID'),
    viteEnv.VITE_BROKER_ID
  );

  const brokerName = firstNonEmpty(
    broker.display_name,
    broker.displayName,
    broker.broker_name,
    broker.brokerName,
    broker.name,
    getRuntimeValue('BROKER_NAME', 'VITE_BROKER_NAME'),
    viteEnv.VITE_BROKER_NAME,
    humanizeBrokerId(brokerId)
  );

  const explicitProductName = firstNonEmpty(
    broker.product_name,
    broker.productName,
    getRuntimeValue('PRODUCT_NAME', 'VITE_PRODUCT_NAME', 'APP_TITLE', 'VITE_APP_TITLE'),
    viteEnv.VITE_PRODUCT_NAME,
    viteEnv.VITE_APP_TITLE
  );

  const productName = explicitProductName || (
    brokerName
      ? (/\badmin\b/i.test(brokerName) ? brokerName : `${brokerName} Admin`)
      : 'Broker Admin'
  );

  const appTitle = firstNonEmpty(
    broker.document_title,
    broker.documentTitle,
    getRuntimeValue('DOCUMENT_TITLE', 'VITE_DOCUMENT_TITLE', 'APP_TITLE', 'VITE_APP_TITLE'),
    viteEnv.VITE_DOCUMENT_TITLE,
    viteEnv.VITE_APP_TITLE,
    productName
  ) || 'Broker Admin';

  const shortName = firstNonEmpty(brokerName, explicitProductName, 'Broker Admin');
  const monogram = getBrokerMonogram(shortName);
  const logoUrl = resolveBrokerLogoUrl(broker);
  const faviconUrl = resolveBrokerFaviconUrl(broker);

  const supportEmail = [
    broker.support_email,
    broker.supportEmail,
    broker.admin_email,
    broker.adminEmail,
    getRuntimeValue('SUPPORT_EMAIL', 'VITE_SUPPORT_EMAIL'),
    viteEnv.VITE_SUPPORT_EMAIL,
  ]
    .map((val) => String(val || '').trim())
    .find(isUsableSupportEmail) || 'support@example.com';

  const supportName = firstNonEmpty(
    broker.support_name,
    broker.supportName,
    getRuntimeValue('SUPPORT_NAME', 'VITE_SUPPORT_NAME', 'SUPPORT_CENTER_NAME', 'VITE_SUPPORT_CENTER_NAME'),
    viteEnv.VITE_SUPPORT_NAME,
    viteEnv.VITE_SUPPORT_CENTER_NAME,
    brokerName ? `${brokerName} Support Center` : 'Support Center'
  );

  const vendorName = firstNonEmpty(
    broker.vendor_name,
    broker.vendorName,
    broker.company_name,
    broker.companyName,
    getRuntimeValue('VENDOR_NAME', 'VITE_VENDOR_NAME'),
    viteEnv.VITE_VENDOR_NAME,
    brokerName,
    'Broker Platform'
  );

  const serverName = firstNonEmpty(
    broker.display_server,
    broker.server_display,
    broker.server_name,
    broker.server,
    broker.broker_name,
    broker.display_name,
    broker.name,
    getRuntimeValue('BROKER_SERVER', 'VITE_BROKER_SERVER', 'DEFAULT_MT5_SERVER', 'VITE_DEFAULT_MT5_SERVER'),
    viteEnv.VITE_BROKER_SERVER,
    viteEnv.VITE_DEFAULT_MT5_SERVER,
    'Trade Server'
  );

  const appVersion = firstNonEmpty(
    broker.app_version,
    getRuntimeValue('APP_VERSION', 'VITE_APP_VERSION'),
    viteEnv.VITE_APP_VERSION,
    '1.0.0'
  );

  return {
    brokerId,
    brokerName,
    productName,
    appTitle,
    shortName,
    monogram,
    logoUrl,
    faviconUrl,
    supportEmail,
    supportName,
    vendorName,
    serverName,
    appVersion,
  };
};

export const applyBrokerBrandingToDocument = (brandingOverride = null) => {
  if (typeof document === 'undefined') return null;
  const branding = brandingOverride && typeof brandingOverride === 'object'
    ? brandingOverride
    : getBrokerBranding();
  const title = String(branding?.appTitle || '').trim() || 'Broker Admin';
  try {
    document.title = title;
  } catch { /* noop */ }
  const faviconUrl = String(branding?.faviconUrl || '').trim();
  if (faviconUrl) {
    try {
      let link = document.querySelector('link[rel="icon"]');
      if (!link) {
        link = document.createElement('link');
        link.setAttribute('rel', 'icon');
        document.head.appendChild(link);
      }
      link.setAttribute('href', faviconUrl);
    } catch { /* noop */ }
  }
  try {
    const brandName = document.getElementById('workspace-loading-brand-name');
    if (brandName && branding?.productName) brandName.textContent = branding.productName;
    const brandLogo = document.getElementById('workspace-loading-brand-logo');
    if (brandLogo && branding?.logoUrl) brandLogo.setAttribute('src', branding.logoUrl);
  } catch { /* noop */ }
  return { title, faviconUrl };
};

export const formatBrokerConnectionStatus = ({
  status = 'ok',
  lastError = null,
  broker = null,
} = {}) => {
  const { serverName } = getBrokerBranding(broker);
  if (status === 'error') {
    return `Connection issue: ${lastError || 'Unavailable'}`;
  }
  if (status === 'connecting' || status === 'reconnecting') {
    return `Connecting to ${serverName}`;
  }
  if (status === 'disconnected' || status === 'offline') {
    return `Disconnected from ${serverName}`;
  }
  return `Connected to ${serverName}`;
};
