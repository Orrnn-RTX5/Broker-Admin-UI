export const emptyCredentials = () => ({ sender_comp_id: '', sender_sub_id: '', username: '', password: '', account_id: '' });
export const emptyConnection = () => ({ id: '', name: '', provider: 'cserver', environment: 'demo', account_mode: 'hedging', enabled: false, origin: 'broker_owned', revision: 0,
  ...Object.fromEntries(['quote', 'trade'].map(role => [role, { role, enabled: false, endpoint: { host: '', port: 0, tls: true, target_comp_id: '' } }])) });
export function saveConnectionPayload(config, credentials) {
  if (config.origin !== 'broker_owned') throw new Error('Supplied connections support enable or disable only.');
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(config.id)) throw new Error('Enter a valid connection ID (letters, numbers, dot, underscore or hyphen).');
  if (!config.name.trim() || !config.environment.trim()) throw new Error('Name and environment are required.');
  const payload = { expected_revision: config.revision, config };
  for (const role of ['quote', 'trade']) {
    const endpoint = config[role].endpoint;
    if (config[role].enabled && (!endpoint.host.trim() || !endpoint.target_comp_id.trim() || !Number.isInteger(endpoint.port) || endpoint.port < 1 || endpoint.port > 65535)) throw new Error(`${role}: enter a host, target Comp ID and port from 1 to 65535.`);
    const value = credentials[role];
    if (Object.values(value).some(Boolean)) {
      if (!['sender_comp_id', 'username', 'password', 'account_id'].every(key => value[key])) throw new Error(`${role}: replacement requires sender Comp ID, username, password and account ID.`);
      payload[`${role}_credentials`] = { ...value };
    } else if (!config.revision && config[role].enabled) throw new Error(`${role}: credentials are required for a new enabled session.`);
  }
  return payload;
}
export function connectionResult(result) {
  const messages = [];
  if (result.saved) messages.push(`Saved revision ${result.saved_revision}.`);
  if (result.applied_revision) messages.push(`Runtime revision ${result.applied_revision}.`);
  if (result.connection_error_code) messages.push(`Connection requires attention: ${result.connection_error_code}.`);
  if (result.test_kind === 'connection_logon' && result.orders_submitted === false) messages.push('Logon test finished. No orders submitted. This does not verify trading capability.');
  return messages.join(' ') || 'Connection updated.';
}
export function connectionError(error) {
  const status = error.response?.status;
  const backend = error.response?.data;
  if (status === 401 || status === 419 ||
    (status === 403 && backend?.code === 'MT_RET_ERR_PERMISSIONS' && /^Not authenticated\b/i.test(backend?.message || ''))) {
    return 'Your admin session was rejected. Sign in again, then refresh the connection list.';
  }
  const code = error.response?.data?.error_code;
  if (code === 'CONFIGURATION_APPLY_REJECTED') return 'Connection change was rejected and not saved. Previous saved settings were retained.';
  if (code === 'CONFIGURATION_RUNTIME_UNAVAILABLE') return 'Connection change was not saved. Runtime restoration is unavailable; refresh and inspect the connection before retrying.';
  if (code === 'CONFIGURATION_COMMIT_UNCERTAIN') return 'The save outcome is uncertain. Refresh the authoritative settings before making another change.';
  if (code === 'CONFIGURATION_CONFLICT') return 'Configuration changed elsewhere. Refresh and review the current revision before saving again.';
  if (code === 'CONFIGURATION_IN_USE') return 'This configuration is in use. Resolve its active execution dependencies before changing it.';
  if (code === 'CONFIGURATION_GUARD_REQUIRED') return 'Activation is unavailable until the backend configuration guard is ready. Your saved configuration can remain disabled.';
  return /^[A-Z][A-Z0-9_]{0,63}$/.test(code || '') ? `Request failed: ${code}.` : 'Request failed. Check your session and connection, then refresh.';
}
