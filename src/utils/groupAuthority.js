import { bookTypeToRoutingMode } from './adminValidation.js';

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

// Keys a GroupCreate or GroupUpdate body must not carry:
//  - symbolSettings: per-symbol terms, saved only through GroupSymbolsSave.
//  - overriddenFields: derived by the backend from the inherited fields a body sends.
//  - quoteFeed, routingRules: refused by GroupUpdate when present, null included
//    (group_contract.go:155-158). GroupCreate does not take them either: the create form has
//    no such field and the backend's group record has no such field (groups.go groupRecord),
//    so they are only ever changed through their own endpoints.
// A parent lookup or an edited record copies these into the form, so every write body is
// built through groupWriteBody.
export const GROUP_WRITE_EXCLUDED_FIELDS = Object.freeze(['symbolSettings', 'overriddenFields', 'quoteFeed', 'routingRules']);

// A G8 group revision as the API returns it. Anything else is treated as no revision: the
// backend checks an expected_revision key strictly, so an empty or invalid value must be omitted.
export const GROUP_REVISION_PATTERN = /^lcr1:[0-9a-f]{24}$/;
export const validGroupRevision = (value) => (typeof value === 'string' && GROUP_REVISION_PATTERN.test(value) ? value : undefined);

export const groupWriteBody = (payload) => Object.fromEntries(
  Object.entries(payload || {}).filter(([key]) => !GROUP_WRITE_EXCLUDED_FIELDS.includes(key)),
);

// GroupCreate body: a root create carries every field; a subgroup create carries parentGroup and
// only the overrides in changedFields (subgroupCreatePayload), never the write-excluded keys.
export const groupCreateBody = (validated, parentGroup, changedFields = []) =>
  groupWriteBody(subgroupCreatePayload(validated, parentGroup, changedFields));

// A subgroup duplicate starts with the source's own overrides as changed fields. Only inheritable
// fields that a create can carry qualify (never symbolSettings, quoteFeed or routingRules).
export const duplicateOverrideSeed = (overriddenFields) => (Array.isArray(overriddenFields) ? overriddenFields : [])
  .filter(field => GROUP_INHERITABLE_FIELDS.includes(field) && !GROUP_WRITE_EXCLUDED_FIELDS.includes(field));

// The form fields a group edit can change. groupOverrideUpdate (group_contract.go:190) marks every
// inherited key present in a GroupUpdate body as overridden, so unchanged fields are never sent.
export const GROUP_EDIT_FIELDS = Object.freeze([
  'description', 'currency', 'leverage', 'marginCallLevel', 'stopOutLevel', 'commissionRate',
  'commissionType', 'swapMultiplier', 'spreadMarkup', 'maxLotPerTrade', 'maxTotalLots',
  'executionMode', 'bookType', 'negativeBalanceProtection', 'tradeAllowed', 'demo', 'accountType',
  'lotDivisor', 'symbolsAllowed', 'symbolsBlocked',
]);

// Fields the backend stores as numbers. Only these compare numerically; every other scalar compares as trimmed
// text, so a description "1.0" and "1" are different values.
export const GROUP_NUMERIC_FIELDS = Object.freeze([
  'leverage', 'marginCallLevel', 'stopOutLevel', 'commissionRate', 'swapMultiplier', 'spreadMarkup',
  'maxLotPerTrade', 'maxTotalLots', 'lotDivisor',
]);

const isBlank = value => value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
const textOf = value => (isBlank(value) ? '' : String(value).trim());
const numberOf = value => {
  if (isBlank(value)) return '';
  const number = typeof value === 'number' ? value : Number(String(value).trim());
  return Number.isFinite(number) ? number : textOf(value);
};
const listOf = value => (Array.isArray(value) ? value : (isBlank(value) ? [] : [value])).map(textOf);

// Compares a validated form value with a loaded record value. Booleans compare strictly; numeric fields
// (GROUP_NUMERIC_FIELDS) compare as numbers, so '200' equals 200; every other scalar compares as trimmed text;
// blank equals missing; symbol lists compare in order (the stored list is ordered).
export const sameGroupFieldValue = (a, b, field) => {
  if (Array.isArray(a) || Array.isArray(b)) {
    const left = listOf(a);
    const right = listOf(b);
    return left.length === right.length && left.every((item, index) => item === right[index]);
  }
  if (typeof a === 'boolean' || typeof b === 'boolean') return a === b;
  if (GROUP_NUMERIC_FIELDS.includes(field)) return numberOf(a) === numberOf(b);
  return textOf(a) === textOf(b);
};

// A duplicate keeps the source's own routingMode when it is not the value derived from its book type.
// buildGroupRiskPayload derives routingMode from bookType (adminValidation.js:206-213), which loses a non-derived
// value such as 'hybrid'. A book change derives it again (UI-2), so no override is returned then.
// Subgroup: kept only when the source overrides routingMode (overriddenFields).
// Root: created roots have overriddenFields [] (group_contract.go:139), and a root edit that changes bookType records
// routingMode as an override too (group_contract.go:190 is not parent-gated). So for roots the value decides: the
// source's routingMode is kept when it differs from the value derived from the source's bookType.
const bookKey = value => String(value ?? '').trim().toLowerCase();
export const duplicateRoutingOverride = (source, validated) => {
  const sourceRouting = typeof source?.routingMode === 'string' ? source.routingMode.trim() : '';
  if (!sourceRouting) return undefined;
  if (bookKey(validated?.bookType) !== bookKey(source?.bookType)) return undefined;
  if (source.parentGroup) {
    const overrides = Array.isArray(source.overriddenFields) ? source.overriddenFields : [];
    return overrides.includes('routingMode') ? sourceRouting : undefined;
  }
  return sourceRouting !== bookTypeToRoutingMode(source.bookType) ? sourceRouting : undefined;
};

// GroupUpdate body for an edit. Identity: the group name is read from the `group` / `group_name`
// query parameter, falling back to the body (groups.go:522-538); ManagerService.updateGroup sends
// it as group_name from originalName. The body `name` is not a stored field. expected_revision is
// sent only when the loaded record carries a valid revision (groups.go:547 expectedRevisionFromBody);
// it is optional unless RTX5_LEGACY_CONFIG_REQUIRE_REVISION is set (legacy_config_guard.go:58, :138).
// parentGroup is never an identity key here: the backend treats its mere presence in a GroupUpdate
// body as a reparent (groups.go:662 `_, reparenting := body["parentGroup"]`, which also drives the
// subtree lock at :822 and the LP inheritance check at :809). It is sent only when the parent
// actually changed; null and '' are the same "no parent".
// A field the loaded record does not have is compared only if the user touched it (touched = the
// form's changed fields); GroupList rows carry every GROUP_EDIT_FIELDS key (groups.go groupRecord, no omitempty).
// Returns null when no field changed, so the caller makes no call.
export const groupUpdateBody = (validated, loaded, touched = new Set()) => {
  const changes = GROUP_EDIT_FIELDS.filter(field => validated[field] !== undefined
    && (loaded?.[field] !== undefined || touched.has(field))
    && !sameGroupFieldValue(validated[field], loaded?.[field], field));
  const parentChanged = validated.parentGroup !== undefined
    && !sameGroupFieldValue(validated.parentGroup, loaded?.parentGroup, 'parentGroup');
  if (changes.length === 0 && !parentChanged) return null;
  const body = Object.fromEntries(changes.map(field => [field, validated[field]]));
  // UI-2: a book change always carries the derived routing mode.
  if (changes.includes('bookType') && validated.routingMode !== undefined) body.routingMode = validated.routingMode;
  if (parentChanged) body.parentGroup = String(validated.parentGroup ?? '').trim() || null;
  const revision = validGroupRevision(loaded.revision);
  return groupWriteBody({ ...body, originalName: loaded.name, ...(revision ? { expected_revision: revision } : {}) });
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
