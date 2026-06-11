// Builds the POST /api/v1/manager/gateway/feed/config request body from the
// feed-provider form state in GatewaysView.
//
// Contract notes (manager-backend handlers/feed_config.go):
// - cserver.symbols is a comma-separated STRING (`Symbols *string`, mirrors
//   CSERVER_SYMBOLS). Sending a JSON array fails Go decoding and the manager
//   rejects the whole request with 400 "Invalid request body".
// - password is write-only: only sent when the operator typed a replacement,
//   never trimmed (passwords may legitimately contain whitespace) and never
//   echoed back by the GET endpoint.

const canonicalKey = (key) =>
  String(key || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();

const stripQuotes = (value) => {
  const text = String(value ?? '').trim();
  if (text.length < 2) return text;
  const first = text[0];
  const last = text[text.length - 1];
  if ((first === '"' && last === '"') || (first === "'" && last === "'") || (first === '`' && last === '`')) {
    return text.slice(1, -1);
  }
  return text;
};

export const normalizeFeedProvider = (provider) => {
  const value = String(provider || '').trim();
  if (!value) return '';

  const key = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  if ([
    'rtxmd',
    'rtx_md',
    'rtx_market_data',
    'rtx_market_data_fix',
    'rtx_market_data_fix_upstream',
    'superadmin_rtx_market_data',
    'superadmin_rtx_market_data_fix',
  ].includes(key)) {
    return 'rtxmd';
  }

  if (['cserver', 'c_server', 'equinix_fix', 'equinix_fix_4_4'].includes(key)) return 'equinix';
  if (['tools_for_brokers', 'tools4brokers', 'tools_for_brokers_fix'].includes(key)) return 't4b';
  return key;
};

const isAllSymbolsValue = (symbols) => {
  if (Array.isArray(symbols)) {
    return symbols.length === 0 || symbols.every((symbol) => isAllSymbolsValue(symbol));
  }
  const value = String(symbols ?? '').trim().toUpperCase();
  return value === '' || value === '*' || value === 'ALL' || value === 'ALL_SYMBOLS';
};

export const symbolsToCsv = (symbols) => {
  if (Array.isArray(symbols)) {
    return symbols
      .map((symbol) => String(symbol ?? '').trim())
      .filter(Boolean)
      .join(',');
  }

  return String(symbols || '')
    .split(/[,;\n\r]+/)
    .map((symbol) => symbol.trim())
    .filter(Boolean)
    .join(',');
};

const parseBool = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const normalized = String(value ?? '').trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on', 'enabled'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off', 'disabled'].includes(normalized)) return false;
  return undefined;
};

const addMappedValue = (map, key, value) => {
  const canonical = canonicalKey(key);
  if (!canonical) return;
  map.set(canonical, value);
};

const flattenObject = (map, value, path = []) => {
  if (Array.isArray(value)) {
    addMappedValue(map, path.join('_'), value);
    return;
  }
  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, child]) => flattenObject(map, child, [...path, key]));
    return;
  }

  if (path.length === 0) return;
  addMappedValue(map, path.join('_'), value);
  addMappedValue(map, path[path.length - 1], value);
};

const parseJsonMap = (text) => {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;
  try {
    const parsed = JSON.parse(trimmed);
    const map = new Map();
    flattenObject(map, parsed);
    return map;
  } catch {
    return null;
  }
};

const parseKeyValueMap = (text) => {
  const map = new Map();
  let section = '';

  text.split(/\r?\n/).forEach((rawLine) => {
    let line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith(';') || line.startsWith('//')) return;

    const sectionMatch = line.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      section = canonicalKey(sectionMatch[1]);
      return;
    }

    line = line.replace(/^export\s+/i, '').replace(/^set\s+/i, '');
    const separator = line.search(/[:=]/);
    if (separator <= 0) return;

    const key = stripQuotes(line.slice(0, separator));
    const value = stripQuotes(line.slice(separator + 1));
    addMappedValue(map, key, value);
    if (section) addMappedValue(map, `${section}_${key}`, value);
  });

  return map;
};

const aliases = {
  feed_provider: [
    'FEED_PROVIDER',
    'PROVIDER',
    'MARKET_DATA_PROVIDER',
    'MARKET_DATA_FIX_PROVIDER',
    'RTX_PROVIDER',
    'RTXMD_PROVIDER',
    'RTX_MD_PROVIDER',
  ],
  enabled: [
    'ENABLED',
    'FEED_ENABLED',
    'MARKET_DATA_ENABLED',
    'MARKET_DATA_FIX_ENABLED',
    'CSERVER_ENABLED',
    'RTXMD_ENABLED',
    'RTX_MD_ENABLED',
  ],
  host: [
    'CSERVER_HOST',
    'HOST',
    'FIX_HOST',
    'MARKET_DATA_HOST',
    'MARKET_DATA_FIX_HOST',
    'RTXMD_HOST',
    'RTX_MD_HOST',
    'RTX_MARKET_DATA_HOST',
    'RTX_MARKET_DATA_FIX_HOST',
  ],
  port: [
    'CSERVER_PORT',
    'PORT',
    'FIX_PORT',
    'MARKET_DATA_PORT',
    'MARKET_DATA_FIX_PORT',
    'RTXMD_PORT',
    'RTX_MD_PORT',
    'RTX_MARKET_DATA_PORT',
    'RTX_MARKET_DATA_FIX_PORT',
  ],
  sender_comp_id: [
    'CSERVER_SENDER_COMP_ID',
    'SENDER_COMP_ID',
    'FIX_SENDER_COMP_ID',
    'MARKET_DATA_SENDER_COMP_ID',
    'MARKET_DATA_FIX_SENDER_COMP_ID',
    'RTXMD_SENDER_COMP_ID',
    'RTX_MD_SENDER_COMP_ID',
  ],
  target_comp_id: [
    'CSERVER_TARGET_COMP_ID',
    'TARGET_COMP_ID',
    'FIX_TARGET_COMP_ID',
    'MARKET_DATA_TARGET_COMP_ID',
    'MARKET_DATA_FIX_TARGET_COMP_ID',
    'RTXMD_TARGET_COMP_ID',
    'RTX_MD_TARGET_COMP_ID',
  ],
  username: [
    'CSERVER_USERNAME',
    'USERNAME',
    'FIX_USERNAME',
    'MARKET_DATA_USERNAME',
    'MARKET_DATA_FIX_USERNAME',
    'RTXMD_USERNAME',
    'RTX_MD_USERNAME',
  ],
  password: [
    'CSERVER_PASSWORD',
    'PASSWORD',
    'FIX_PASSWORD',
    'MARKET_DATA_PASSWORD',
    'MARKET_DATA_FIX_PASSWORD',
    'RTXMD_PASSWORD',
    'RTX_MD_PASSWORD',
  ],
  use_ssl: [
    'CSERVER_USE_SSL',
    'USE_SSL',
    'SSL',
    'TLS',
    'FIX_USE_SSL',
    'MARKET_DATA_USE_SSL',
    'MARKET_DATA_FIX_USE_SSL',
    'RTXMD_USE_SSL',
    'RTX_MD_USE_SSL',
  ],
  symbols: [
    'CSERVER_SYMBOLS',
    'SYMBOLS',
    'FIX_SYMBOLS',
    'MARKET_DATA_SYMBOLS',
    'MARKET_DATA_FIX_SYMBOLS',
    'RTXMD_SYMBOLS',
    'RTX_MD_SYMBOLS',
  ],
  all_symbols: [
    'ALL_SYMBOLS',
    'SUBSCRIBE_ALL_SYMBOLS',
    'CSERVER_ALL_SYMBOLS',
    'MARKET_DATA_ALL_SYMBOLS',
    'MARKET_DATA_FIX_ALL_SYMBOLS',
    'RTXMD_ALL_SYMBOLS',
    'RTX_MD_ALL_SYMBOLS',
  ],
  catalog_file: [
    'CSERVER_CATALOG_FILE',
    'CATALOG_FILE',
    'FIX_CATALOG_FILE',
    'MARKET_DATA_CATALOG_FILE',
    'MARKET_DATA_FIX_CATALOG_FILE',
    'RTXMD_CATALOG_FILE',
    'RTX_MD_CATALOG_FILE',
  ],
};

const firstValue = (map, keys) => {
  for (const key of keys) {
    const canonical = canonicalKey(key);
    if (map.has(canonical)) return map.get(canonical);
  }
  return undefined;
};

const assignText = (out, map, field) => {
  const value = firstValue(map, aliases[field]);
  if (value === undefined || value === null) return;
  const text = String(value);
  if (text.trim() === '') return;
  out[field] = text.trim();
};

export const parseFeedConfigImport = (raw) => {
  const text = String(raw || '').trim();
  if (!text) return {};

  const map = parseJsonMap(text) || parseKeyValueMap(text);
  const out = {};

  const provider = firstValue(map, aliases.feed_provider);
  if (provider !== undefined && String(provider).trim() !== '') {
    out.feed_provider = normalizeFeedProvider(provider);
  }

  const enabled = parseBool(firstValue(map, aliases.enabled));
  if (enabled !== undefined) out.enabled = enabled;

  ['host', 'port', 'sender_comp_id', 'target_comp_id', 'username', 'catalog_file'].forEach((field) => {
    assignText(out, map, field);
  });

  const useSsl = parseBool(firstValue(map, aliases.use_ssl));
  if (useSsl !== undefined) out.use_ssl = useSsl;

  const password = firstValue(map, aliases.password);
  if (password !== undefined && password !== null && String(password) !== '') {
    out.password = String(password);
  }

  const allSymbols = parseBool(firstValue(map, aliases.all_symbols));
  if (allSymbols !== undefined) out.all_symbols = allSymbols;

  const symbols = firstValue(map, aliases.symbols);
  if (symbols !== undefined && symbols !== null) {
    if (isAllSymbolsValue(symbols)) {
      out.all_symbols = true;
      out.symbols = '';
    } else {
      out.all_symbols = false;
      out.symbols = symbolsToCsv(symbols);
    }
  }

  if (out.all_symbols) out.symbols = '';
  return out;
};

export const buildFeedConfigPayload = (form) => {
  const payload = {
    feed_provider: normalizeFeedProvider(form.feed_provider) || 'rtxmd',
    enabled: Boolean(form.enabled),
    cserver: {
      host: form.host.trim(),
      port: Number(form.port) || 0,
      sender_comp_id: form.sender_comp_id.trim(),
      target_comp_id: form.target_comp_id.trim(),
      username: form.username.trim(),
      use_ssl: Boolean(form.use_ssl),
      symbols: form.all_symbols ? '' : symbolsToCsv(form.symbols),
      catalog_file: form.catalog_file.trim(),
    },
  };

  if (form.password) payload.password = form.password;

  return payload;
};
