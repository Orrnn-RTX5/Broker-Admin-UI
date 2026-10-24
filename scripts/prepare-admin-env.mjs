import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const publicFields = ['BACKEND_TARGET', 'BROKER_ID', 'BROKER_NAME', 'API_HOST',
  'API_HOST_EXT', 'WS_HOST', 'FEED_WS_URL', 'FEED_STATUS_URL', 'DEFAULT_MT5_SERVER',
  'DISCOVERY_BASE_URL', 'DEFAULT_DISCOVERY_BASE_URL',
  'USE_MOCK_DISCOVERY', 'FEED_SEND_TOKEN', 'FEED_BROKER_ID', 'FEED_BROKER_TOKEN'];

export function normalizeAdminEnv(raw) {
  if (typeof raw !== 'string' || !raw.trim()) throw new Error('ADMIN_UI_ENV is missing or empty.');
  if (Buffer.byteLength(raw) > 48 * 1024 || /\0/.test(raw)) throw new Error('ADMIN_UI_ENV has an invalid size or contains a null byte.');
  const values = new Map();
  for (const [index, line] of raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').split('\n').entries()) {
    if (!line.trim() || /^\s*#/.test(line)) continue;
    const entry = /^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
    if (!entry || /\r/.test(line)) throw new Error(`ADMIN_UI_ENV has a malformed entry on line ${index + 1}.`);
    const [, key, value] = entry;
    if (values.has(key)) throw new Error(`ADMIN_UI_ENV defines ${key} more than once.`);
    values.set(key, value);
  }
  for (const field of publicFields) {
    const plain = values.get(field);
    const vite = values.get(`VITE_${field}`);
    if (plain && vite && plain !== vite) throw new Error(`ADMIN_UI_ENV has conflicting ${field} aliases.`);
  }
  const effective = (key) => values.get(key) || values.get(`VITE_${key}`) || '';
  if (!effective('BROKER_ID').trim()) throw new Error('ADMIN_UI_ENV must set BROKER_ID or VITE_BROKER_ID.');
  const requireUrl = (key, protocol) => {
    const value = effective(key);
    let url;
    try { url = new URL(value); } catch { /* Report the key, never the secret value. */ }
    if (!url || !value.startsWith(`${protocol}//`) || /\\/.test(value) ||
        url.protocol !== protocol || !url.hostname || url.username || url.password ||
        url.hash || url.search || /\s/.test(value)) {
      throw new Error(`ADMIN_UI_ENV must set ${key} or VITE_${key} to a plain ${protocol}// URL.`);
    }
    return url;
  };
  requireUrl('API_HOST', 'https:');
  const ws = requireUrl('FEED_WS_URL', 'wss:');
  const status = requireUrl('FEED_STATUS_URL', 'https:');
  if (ws.pathname !== '/ws/feed' || status.pathname !== '/ws/feed/status' || ws.host !== status.host) {
    throw new Error('ADMIN_UI_ENV feed URLs must use the same host and /ws/feed plus /ws/feed/status paths.');
  }
  return [...values].map(([key, value]) => `${key}=${value}`).join('\n') + '\n';
}

export function prepareAdminEnv(env = process.env, output = console.log) {
  const text = normalizeAdminEnv(env.ADMIN_UI_ENV);
  if (!env.GITHUB_ENV) throw new Error('GITHUB_ENV is unavailable.');
  const encoded = Buffer.from(text, 'utf8').toString('base64');
  // The SSH action receives a single safe line. Mask this transformed secret too.
  output(`::add-mask::${encoded}`);
  appendFileSync(env.GITHUB_ENV, `ADMIN_UI_ENV_B64=${encoded}\n`, { mode: 0o600 });
  output('ADMIN_UI_ENV validated for runtime deployment.');
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { prepareAdminEnv(); } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
