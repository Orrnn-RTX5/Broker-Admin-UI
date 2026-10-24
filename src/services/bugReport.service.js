import { api } from '../lib/api';

// Bug reporting from the Admin UI.
//
// The report goes to the broker's manager backend, which forwards it to the
// RTX5 control plane. Nothing about a bug report is stored in the broker's own
// database, and the browser never talks to object storage directly.
//
// The backend derives the broker, the login and the reporter's role from the
// session, so nothing sent from here can impersonate another reporter. The same
// endpoint serves the Manager UI; the two are told apart by whether the session
// is an admin one.

const OPTIONS_ENDPOINT = '/api/v1/manager/bug-reports/options';
const SUBMIT_ENDPOINT = '/api/v1/manager/bug-reports';

export const MAX_ATTACHMENTS = 5;
export const MAX_FILE_BYTES = 8 * 1024 * 1024;

// The backend re-checks each file's magic bytes rather than trusting the
// browser's label. SVG is absent deliberately: it can carry script, and a
// stored one would later be shown to a reviewer.
export const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'text/plain'];

export const CATEGORY_LABELS = {
  trading: 'Trading',
  order: 'Orders',
  position: 'Positions',
  market_data: 'Market data',
  authentication: 'Authentication',
  ui_ux: 'UI / UX',
  performance: 'Performance',
  connection: 'Connection',
  account: 'Account',
  configuration: 'Configuration',
  other: 'Other',
};

export const SEVERITY_LABELS = {
  low: 'Low — cosmetic or minor',
  medium: 'Medium — works, but wrongly',
  high: 'High — important function broken',
  critical: 'Critical — trading or account integrity affected',
};

export const fetchBugReportOptions = async () => {
  try {
    const response = await api({ url: OPTIONS_ENDPOINT, method: 'GET' });
    const data = response?.data || {};
    return {
      categories: data.categories || Object.keys(CATEGORY_LABELS),
      severities: data.severities || Object.keys(SEVERITY_LABELS),
      enabled: data.enabled !== false,
    };
  } catch {
    // The form still works with the built-in lists; only the "not configured"
    // hint is lost, and a failed submission will say so explicitly.
    return { categories: Object.keys(CATEGORY_LABELS), severities: Object.keys(SEVERITY_LABELS), enabled: true };
  }
};

// Collected automatically so the reporter does not describe their own browser.
// Deliberately narrow: this is everything sent, and it never reads storage,
// tokens or cookies.
export const collectEnvironment = () => {
  const environment = {
    app_version: (import.meta.env && import.meta.env.VITE_APP_VERSION) || '',
    route: typeof window !== 'undefined' ? window.location?.hash || window.location?.pathname || '' : '',
    os: typeof navigator !== 'undefined' ? navigator.platform || '' : '',
    browser: typeof navigator !== 'undefined' ? navigator.userAgent || '' : '',
    screen_resolution: typeof window !== 'undefined' && window.screen
      ? `${window.screen.width}x${window.screen.height}`
      : '',
    locale: typeof navigator !== 'undefined' ? navigator.language || '' : '',
    timezone: '',
  };
  try {
    environment.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    environment.timezone = '';
  }
  return environment;
};

export const validateAttachment = (file) => {
  if (!file) return 'No file selected';
  if (file.size > MAX_FILE_BYTES) {
    return `${file.name || 'That file'} is larger than ${MAX_FILE_BYTES / (1024 * 1024)} MB`;
  }
  if (file.type && !ACCEPTED_TYPES.includes(file.type)) {
    return `${file.name || 'That file'} is not an accepted type (PNG, JPEG, WEBP or plain text)`;
  }
  return null;
};

// Convert attached screenshots before upload and keep the original if WebP
// is unsupported or larger. Text logs and existing WebP files are untouched.
const compressScreenshot = async (file) => {
  if (!['image/png', 'image/jpeg'].includes(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext('2d');
      if (!context) return file;
      context.drawImage(bitmap, 0, 0);
      for (const quality of [0.82, 0.68]) {
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
        if (blob?.type === 'image/webp' && blob.size < file.size) {
          return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.webp`, {
            type: 'image/webp',
            lastModified: file.lastModified,
          });
        }
      }
    } finally {
      bitmap.close();
    }
  } catch {
    // A corrupt or unsupported image can still be submitted in its original form.
  }
  return file;
};

export const submitBugReport = async ({ form, attachments = [] }) => {
  const payload = {
    title: form.title,
    description: form.description,
    category: form.category,
    severity: form.severity,
    steps_to_reproduce: (form.steps || '')
      .split('\n')
      .map((line) => line.replace(/^\s*\d+[).]?\s*/, '').trim())
      .filter(Boolean),
    expected_behavior: form.expected || '',
    actual_behavior: form.actual || '',
    occurred_at: Math.floor(Date.now() / 1000),
    page: form.page || '',
    ...collectEnvironment(),
  };

  const body = new FormData();
  body.append('payload', JSON.stringify(payload));
  const uploadFiles = await Promise.all(attachments.map(compressScreenshot));
  uploadFiles.forEach((file) => body.append('attachments', file, file.name));

  try {
    // Content-Type is set to undefined so the browser supplies the multipart
    // boundary; the shared axios instance otherwise forces application/json.
    const response = await api({
      url: SUBMIT_ENDPOINT,
      method: 'POST',
      data: body,
      headers: { 'Content-Type': undefined },
    });
    return response?.data || {};
  } catch (error) {
    const status = error?.response?.status;
    if (status === 503) {
      throw new Error('Bug reporting is not configured on this server yet. Please contact your administrator.');
    }
    if (status === 502) {
      throw new Error('The support service could not be reached. Please try again in a moment.');
    }
    throw new Error(error?.response?.data?.error || error?.message || 'The report could not be submitted');
  }
};
