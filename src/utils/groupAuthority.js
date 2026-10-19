export const GROUP_INHERITABLE_FIELDS = Object.freeze([
  'description', 'currency', 'leverage', 'marginCallLevel', 'stopOutLevel',
  'commissionRate', 'commissionType', 'swapMultiplier', 'spreadMarkup',
  'maxLotPerTrade', 'maxTotalLots', 'executionMode', 'bookType',
  'negativeBalanceProtection', 'tradeAllowed', 'demo', 'accountType',
  'lotDivisor', 'routingMode', 'symbolsAllowed', 'symbolsBlocked',
  'symbolSettings', 'quoteFeed', 'routingRules', 'groupPurpose',
]);

export const groupFieldLabel = field => ({ quoteFeed: 'Quote feed', routingRules: 'Routing rules', groupPurpose: 'Account purpose', symbolSettings: 'Symbol settings' }[field]
  || field.replace(/([A-Z])/g, ' $1').replace(/^./, letter => letter.toUpperCase()));

export const groupFieldState = (group, field) => !group?.parentGroup ? 'Local'
  : group.overriddenFields?.includes(field) ? 'Override' : `Inherited from ${group.parentGroup}`;

// Creation sends only deliberate child overrides, preserving continuous inheritance.
// bookType owns routingMode (UI-2): a bookType override always carries the
// derived routingMode so a subgroup cannot inherit a stale routing mode.
export const subgroupCreatePayload = (payload, parentGroup, changedFields = []) => {
  if (!parentGroup) return { ...payload, parentGroup: null };
  const overrides = [...new Set(changedFields)].filter(field => GROUP_INHERITABLE_FIELDS.includes(field));
  if (overrides.includes('bookType') && !overrides.includes('routingMode')
    && GROUP_INHERITABLE_FIELDS.includes('routingMode') && payload.routingMode !== undefined) {
    overrides.push('routingMode');
  }
  return { name: payload.name, parentGroup, overriddenFields: overrides,
    ...Object.fromEntries(overrides.filter(field => payload[field] !== undefined).map(field => [field, payload[field]])) };
};

export const inheritedFieldReset = (group, field) => {
  if (!group?.parentGroup || !GROUP_INHERITABLE_FIELDS.includes(field)) throw new Error('Select a setting in a subgroup to restore inheritance.');
  if (!/^lcr1:[0-9a-f]{24}$/.test(group.revision || '')) throw new Error('Reload the group revision before restoring inheritance.');
  return { inheritFields: [field], expected_revision: group.revision };
};

export const accountCreationWarning = response => {
  const warning = response?.routing_warning || response?.routingWarning;
  const warnings = Array.isArray(response?.warnings) ? response.warnings : [];
  return warning || warnings.find(value => (typeof value === 'string' ? value : value?.message) === 'no routing rule found')?.message
    || (warnings.includes('no routing rule found') ? 'no routing rule found' : '');
};
