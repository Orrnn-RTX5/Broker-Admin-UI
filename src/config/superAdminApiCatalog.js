const endpoint = (id, method, path, label, options = {}) => Object.freeze({
  id,
  method,
  path,
  label,
  auth: options.auth ?? true,
  ...(options.destructive ? { destructive: true } : {}),
  ...(options.fileUpload ? { fileUpload: true } : {}),
  ...(options.fileDownload ? { fileDownload: true } : {}),
  ...(options.stream ? { stream: true } : {}),
});

const section = (id, label, endpoints) => Object.freeze({
  id,
  label,
  endpoints: Object.freeze(endpoints),
});

export const SUPER_ADMIN_API_SECTIONS = Object.freeze([
  section('authentication', 'Authentication', [
    endpoint('authentication.login', 'POST', '/api/v1/admin/auth/login', 'RTX5 Super Admin Login', { auth: false }),
    endpoint('authentication.me', 'GET', '/api/v1/admin/auth/me', 'Current admin session'),
  ]),

  section('system', 'System', [
    endpoint('system.health', 'GET', '/health', 'Process liveness', { auth: false }),
    endpoint('system.readiness', 'GET', '/readiness', 'SuperAdmin deployment readiness', { auth: false }),
    endpoint('system.stats', 'GET', '/api/v1/admin/stats', 'Platform-wide statistics'),
    endpoint('system.audit-log', 'GET', '/api/v1/admin/audit-log', 'Admin audit log'),
  ]),

  section('brokers', 'Brokers', [
    endpoint('brokers.list', 'GET', '/api/v1/admin/brokers', 'List all brokers'),
    endpoint('brokers.create', 'POST', '/api/v1/admin/brokers', 'Register a new broker'),
    endpoint('brokers.get', 'GET', '/api/v1/admin/brokers/{broker_id}', 'Get broker details with servers'),
    endpoint('brokers.update', 'PUT', '/api/v1/admin/brokers/{broker_id}', 'Update broker details'),
    endpoint('brokers.terminate', 'DELETE', '/api/v1/admin/brokers/{broker_id}', 'Terminate a broker', { destructive: true }),
    endpoint('brokers.purge', 'DELETE', '/api/v1/admin/brokers/{broker_id}/purge', 'Permanently delete a broker', { destructive: true }),
    endpoint('brokers.license-sync-status', 'GET', '/api/v1/admin/brokers/{broker_id}/license-sync', 'Inspect runtime license acknowledgements and delivery failures'),
    endpoint('brokers.license-sync-enqueue', 'POST', '/api/v1/admin/brokers/{broker_id}/license-sync', 'Enqueue the current license snapshot'),
    endpoint('brokers.suspend', 'POST', '/api/v1/admin/brokers/{broker_id}/suspend', 'Suspend a broker', { destructive: true }),
    endpoint('brokers.activate', 'POST', '/api/v1/admin/brokers/{broker_id}/activate', 'Reactivate a broker'),
    endpoint('brokers.manager-credentials', 'GET', '/api/v1/admin/brokers/{broker_id}/manager-credentials', "Reveal the broker's admin manager credentials"),
    endpoint('brokers.manager-credentials-reset', 'POST', '/api/v1/admin/brokers/{broker_id}/manager-credentials/reset', "Reset the broker's admin manager password", { destructive: true }),
    endpoint('brokers.stats', 'GET', '/api/v1/admin/brokers/{broker_id}/stats', 'Per-broker statistics'),
    endpoint('brokers.usage', 'GET', '/api/v1/admin/brokers/{broker_id}/usage', 'Broker license usage vs limits'),
    endpoint('brokers.logo-upload', 'POST', '/api/v1/brokers/{broker_id}/logo', 'Upload or replace a broker logo', { fileUpload: true }),
    endpoint('brokers.logo-get', 'GET', '/api/v1/brokers/{broker_id}/logo', 'Fetch the broker logo', { auth: false, fileDownload: true }),
    endpoint('brokers.logo-delete', 'DELETE', '/api/v1/brokers/{broker_id}/logo', 'Delete the broker logo', { destructive: true }),
    endpoint('brokers.central-lp-credentials', 'GET', '/api/v1/admin/brokers/{broker_id}/central-lp-credentials', 'Get broker central feed credentials metadata'),
    endpoint('brokers.central-lp-credentials-generate', 'POST', '/api/v1/admin/brokers/{broker_id}/central-lp-credentials/generate', 'Generate broker credentials for the central market-data feed'),
    endpoint('brokers.manager-provisioning', 'GET', '/api/v1/admin/brokers/{broker_id}/manager-provisioning', 'Get initial manager provisioning status'),
    endpoint('brokers.retry-provision-manager', 'POST', '/api/v1/admin/brokers/{broker_id}/retry-provision-manager', 'Retry initial manager provisioning'),
  ]),

  section('license-management', 'License Management', [
    endpoint('license-management.extend', 'POST', '/api/v1/admin/brokers/{broker_id}/extend', 'Extend broker license expiry'),
    endpoint('license-management.regenerate-key', 'POST', '/api/v1/admin/brokers/{broker_id}/regenerate-key', "Regenerate broker's license key", { destructive: true }),
    endpoint('license-management.plans-list', 'GET', '/api/v1/admin/licenses/plans', 'List all license plans'),
    endpoint('license-management.plans-create', 'POST', '/api/v1/admin/licenses/plans', 'Create a new license plan'),
    endpoint('license-management.plans-get', 'GET', '/api/v1/admin/licenses/plans/{plan_id}', 'Get a single license plan'),
    endpoint('license-management.plans-update', 'PUT', '/api/v1/admin/licenses/plans/{plan_id}', 'Update a license plan'),
    endpoint('license-management.plans-delete', 'DELETE', '/api/v1/admin/licenses/plans/{plan_id}', 'Delete or deactivate a license plan', { destructive: true }),
    endpoint('license-management.expiring', 'GET', '/api/v1/admin/licenses/expiring', 'Brokers with expiring licenses'),
  ]),

  section('broker-servers', 'Broker Servers', [
    endpoint('broker-servers.list', 'GET', '/api/v1/admin/brokers/{broker_id}/servers', "List a broker's servers"),
    endpoint('broker-servers.create', 'POST', '/api/v1/admin/brokers/{broker_id}/servers', 'Add a server to a broker'),
    endpoint('broker-servers.disable', 'DELETE', '/api/v1/admin/brokers/{broker_id}/servers/{server_id}', 'Disable a broker server', { destructive: true }),
    endpoint('broker-servers.enable', 'POST', '/api/v1/admin/brokers/{broker_id}/servers/{server_id}/enable', 'Re-enable a disabled server'),
  ]),

  section('server-monitoring', 'Server Monitoring', [
    endpoint('server-monitoring.ping', 'POST', '/api/v1/admin/brokers/{broker_id}/servers/{server_id}/ping', 'Health-check a specific broker server'),
    endpoint('server-monitoring.list', 'GET', '/api/v1/admin/servers', 'List all servers across all brokers'),
    endpoint('server-monitoring.health', 'GET', '/api/v1/admin/servers/health', 'Bulk health-check all active servers'),
  ]),

  section('market-data-hub', 'Market Data Hub', [
    endpoint('market-data-hub.central-lp-get', 'GET', '/api/v1/admin/market-data/central-lp', 'Get the Central LP configuration and live state'),
    endpoint('market-data-hub.central-lp-update', 'PUT', '/api/v1/admin/market-data/central-lp', 'Test, apply, and persist the Central LP configuration'),
    endpoint('market-data-hub.central-lp-test', 'POST', '/api/v1/admin/market-data/central-lp/test', 'Test a Central LP configuration without saving it'),
    endpoint('market-data-hub.lps-list', 'GET', '/api/v1/admin/market-data/lps', 'List market data liquidity providers'),
    endpoint('market-data-hub.lps-create', 'POST', '/api/v1/admin/market-data/lps', 'Create a market data liquidity provider'),
    endpoint('market-data-hub.lps-get', 'GET', '/api/v1/admin/market-data/lps/{lp_id}', 'Get a market data liquidity provider'),
    endpoint('market-data-hub.lps-update', 'PUT', '/api/v1/admin/market-data/lps/{lp_id}', 'Update a market data liquidity provider'),
    endpoint('market-data-hub.lps-enable', 'POST', '/api/v1/admin/market-data/lps/{lp_id}/enable', 'Enable a market data LP'),
    endpoint('market-data-hub.lps-disable', 'POST', '/api/v1/admin/market-data/lps/{lp_id}/disable', 'Disable a market data LP', { destructive: true }),
    endpoint('market-data-hub.lps-test-saved', 'POST', '/api/v1/admin/market-data/lps/{lp_id}/test', 'Test market data LP connectivity'),
    endpoint('market-data-hub.lps-test-payload', 'POST', '/api/v1/admin/market-data/lps/test', 'Test market data LP connectivity from payload'),
    endpoint('market-data-hub.lps-reconnect', 'POST', '/api/v1/admin/market-data/lps/{lp_id}/reconnect', 'Reconnect a market data LP runtime session'),
    endpoint('market-data-hub.fix-accounts-list', 'GET', '/api/v1/admin/market-data/broker-fix-accounts', 'List broker FIX market data accounts'),
    endpoint('market-data-hub.fix-accounts-create', 'POST', '/api/v1/admin/market-data/broker-fix-accounts', 'Create broker FIX market data account'),
    endpoint('market-data-hub.fix-accounts-get', 'GET', '/api/v1/admin/market-data/broker-fix-accounts/{account_id}', 'Get broker FIX market data account'),
    endpoint('market-data-hub.fix-accounts-update', 'PUT', '/api/v1/admin/market-data/broker-fix-accounts/{account_id}', 'Update broker FIX market data account'),
    endpoint('market-data-hub.fix-accounts-reset-password', 'POST', '/api/v1/admin/market-data/broker-fix-accounts/{account_id}/reset-password', 'Reset broker FIX market data password', { destructive: true }),
    endpoint('market-data-hub.fix-accounts-config', 'GET', '/api/v1/admin/market-data/broker-fix-accounts/{account_id}/config', 'Download masked broker FIX market data config', { fileDownload: true }),
    endpoint('market-data-hub.fix-accounts-config-download', 'GET', '/api/v1/admin/market-data/broker-fix-accounts/{account_id}/config-download', 'Get the normalized broker FIX environment configuration', { fileDownload: true }),
    endpoint('market-data-hub.fix-accounts-enable', 'POST', '/api/v1/admin/market-data/broker-fix-accounts/{account_id}/enable', 'Enable broker FIX market data account'),
    endpoint('market-data-hub.fix-accounts-disable', 'POST', '/api/v1/admin/market-data/broker-fix-accounts/{account_id}/disable', 'Disable broker FIX market data account', { destructive: true }),
    endpoint('market-data-hub.failover-events', 'GET', '/api/v1/admin/market-data/failover-events', 'List market data failover events'),
    endpoint('market-data-hub.fix-sessions-list', 'GET', '/api/v1/admin/market-data/fix-sessions', 'List active broker FIX market data sessions'),
    endpoint('market-data-hub.fix-sessions-get', 'GET', '/api/v1/admin/market-data/fix-sessions/{session_id}', 'Get market data gateway status snapshot for a session route'),
    endpoint('market-data-hub.fix-sessions-disconnect', 'POST', '/api/v1/admin/market-data/fix-sessions/{session_id}/disconnect', 'Disconnect a broker FIX session', { destructive: true }),
    endpoint('market-data-hub.fix-sessions-force-logout', 'POST', '/api/v1/admin/market-data/fix-sessions/{session_id}/force-logout', 'Force logout a broker FIX session', { destructive: true }),
    endpoint('market-data-hub.lp-monitoring-list', 'GET', '/api/v1/admin/market-data/lp-monitoring', 'List market data LP runtime monitoring'),
    endpoint('market-data-hub.lp-monitoring-get', 'GET', '/api/v1/admin/market-data/lp-monitoring/{lp_id}', 'Get LP runtime monitoring detail'),
    endpoint('market-data-hub.audit-log', 'GET', '/api/v1/admin/market-data/audit-log', 'List Market Data Hub audit entries'),
  ]),

  section('market-data-monitoring', 'Market Data Monitoring', [
    endpoint('market-data-monitoring.central-lp-status', 'GET', '/api/v1/admin/market-data/central-lp/status', 'Get the protected Central LP runtime status'),
    endpoint('market-data-monitoring.stream-ticket', 'POST', '/api/v1/admin/market-data/stream-ticket', 'Create a short-lived ticket for the protected live quote stream'),
    endpoint('market-data-monitoring.live-symbols', 'GET', '/api/v1/admin/market-data/live-symbols', 'List live market-data symbols'),
    endpoint('market-data-monitoring.symbol-monitoring', 'GET', '/api/v1/admin/market-data/symbol-monitoring', 'Search and filter symbol health'),
    endpoint('market-data-monitoring.candle-storage', 'GET', '/api/v1/admin/market-data/candle-storage', 'Get candle-storage fleet status'),
    endpoint('market-data-monitoring.candle-storage-symbol', 'GET', '/api/v1/admin/market-data/candle-storage/{symbol}', 'Get stored candle status for a symbol'),
    endpoint('market-data-monitoring.candle-history', 'GET', '/api/v1/admin/market-data/candle-history', 'Read effective candle history with central-live priority'),
    endpoint('market-data-monitoring.candle-gaps', 'GET', '/api/v1/admin/market-data/candle-gaps', 'Scan for candle gaps'),
    endpoint('market-data-monitoring.candle-gaps-candles', 'GET', '/api/v1/admin/market-data/candle-gaps/candles', 'Read candles for gap inspection'),
    endpoint('market-data-monitoring.candle-gaps-backfill', 'POST', '/api/v1/admin/market-data/candle-gaps/backfill', 'Trigger a durable, verified candle-gap backfill'),
    endpoint('market-data-monitoring.candle-gaps-backfill-status', 'GET', '/api/v1/admin/market-data/candle-gaps/backfill/{job_id}', 'Get persisted candle-gap backfill job status'),
    endpoint('market-data-monitoring.candle-gaps-stream', 'GET', '/api/v1/admin/market-data/candle-gaps/stream', 'Stream live candle updates', { stream: true }),
    endpoint('market-data-monitoring.candle-delete', 'POST', '/api/v1/admin/market-data/candle-management/delete', 'Delete selected candles from the dedicated candle store', { destructive: true }),
    endpoint('market-data-monitoring.retention-get', 'GET', '/api/v1/admin/market-data/candle-management/retention', 'Get candle retention policy'),
    endpoint('market-data-monitoring.retention-update', 'PUT', '/api/v1/admin/market-data/candle-management/retention', 'Update candle retention policy'),
  ]),

  section('lp-gateway', 'LP Gateway', [
    endpoint('lp-gateway.required-fields', 'GET', '/api/v1/admin/gateway/lp/required-fields', 'Get required feed-only LP credential fields'),
    endpoint('lp-gateway.status', 'GET', '/api/v1/admin/gateway/lp/status', 'Get feed-only LP gateway status'),
    endpoint('lp-gateway.connect', 'POST', '/api/v1/admin/gateway/lp/connect', 'Connect the feed-only LP gateway'),
    endpoint('lp-gateway.disconnect', 'POST', '/api/v1/admin/gateway/lp/disconnect', 'Disconnect the feed-only LP gateway', { destructive: true }),
  ]),

  section('public', 'Public', [
    endpoint('public.active-broker-servers', 'GET', '/api/v2/broker/servers', 'List all active broker servers', { auth: false }),
  ]),
]);

export const SUPER_ADMIN_API_CATALOG = Object.freeze(
  SUPER_ADMIN_API_SECTIONS.flatMap(({ endpoints }) => endpoints),
);

export const SUPER_ADMIN_API_OPERATIONS = Object.freeze(
  SUPER_ADMIN_API_CATALOG.reduce((acc, endpoint) => {
    acc[endpoint.id] = endpoint;
    const underscoreKey = endpoint.id.replace(/[.-]/g, '_');
    acc[underscoreKey] = endpoint;
    return acc;
  }, {})
);

export const getSuperAdminOperation = (operationOrId) => {
  if (!operationOrId) return null;
  if (typeof operationOrId === 'object' && operationOrId.path) return operationOrId;
  const idStr = String(operationOrId).trim();
  if (SUPER_ADMIN_API_OPERATIONS[idStr]) return SUPER_ADMIN_API_OPERATIONS[idStr];
  const normalized = idStr.toLowerCase().replace(/[.-]/g, '_');
  if (SUPER_ADMIN_API_OPERATIONS[normalized]) return SUPER_ADMIN_API_OPERATIONS[normalized];

  if (idStr === 'auth_me' || idStr === 'auth.me' || idStr === 'authentication_me') {
    return SUPER_ADMIN_API_OPERATIONS['authentication.me'];
  }
  if (idStr === 'auth_login' || idStr === 'login' || idStr === 'authentication_login') {
    return SUPER_ADMIN_API_OPERATIONS['authentication.login'];
  }

  const byPath = SUPER_ADMIN_API_CATALOG.find(
    (e) => e.path === idStr || `${e.method} ${e.path}`.toLowerCase() === idStr.toLowerCase()
  );
  if (byPath) return byPath;

  return null;
};

export const extractPathParams = (path) => (
  [...String(path).matchAll(/\{([^{}]+)\}/g)].map((match) => match[1])
);

