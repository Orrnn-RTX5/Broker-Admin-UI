// Setup is a separate state, regardless of the catalogue's enabled default.
export function symbolManagementStatus(symbol) {
  if (symbol.configurationStatus === 'Setup required') return 'Setup required';
  return symbol.enabled ? 'Enabled' : 'Disabled';
}
