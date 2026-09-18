export const relayFormFromConfig = (config = {}) => ({
  enabled: config.enabled === true,
  host: config.host || '',
  port: config.port ? String(config.port) : '',
  sender_comp_id: config.sender_comp_id || '',
  target_comp_id: config.target_comp_id || '',
  username: config.username || '',
  password: '',
  use_tls: config.use_tls !== false,
  symbols: Array.isArray(config.symbols) ? config.symbols.join(', ') : '',
});

export function buildRelayConfig(form, passwordSet) {
  const symbols = [...new Set(form.symbols.split(',').map((v) => v.trim()).filter(Boolean))];
  const port = Number(form.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Enter a port from 1 to 65535.');
  for (const field of ['host', 'sender_comp_id', 'target_comp_id', 'username']) {
    if (!form[field].trim()) throw new Error(`${field.replaceAll('_', ' ')} is required.`);
  }
  if (!passwordSet && !form.password) throw new Error('Enter the password issued by Superadmin.');
  if (form.enabled && symbols.length === 0) throw new Error('Enter at least one explicitly allowed symbol.');
  if (symbols.includes('*')) throw new Error('Enter explicit symbols; wildcard access is not supported.');
  return {
    enabled: form.enabled,
    host: form.host.trim(), port,
    sender_comp_id: form.sender_comp_id.trim(), target_comp_id: form.target_comp_id.trim(),
    username: form.username.trim(), use_tls: form.use_tls, symbols,
    ...(form.password ? { password: form.password } : {}),
  };
}
