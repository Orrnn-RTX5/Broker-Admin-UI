import test from 'node:test';
import assert from 'node:assert/strict';
import {
  accountCreationWarning, duplicateOverrideSeed, duplicateRoutingOverride, GROUP_EDIT_FIELDS, GROUP_INHERITABLE_FIELDS, groupCreateBody,
  groupFieldState, groupUpdateBody, groupWriteBody, inheritedFieldReset, sameGroupFieldValue, subgroupCreatePayload,
} from './groupAuthority.js';
import { buildGroupRiskPayload } from './adminValidation.js';

const revision = 'lcr1:0123456789abcdef01234567';
test('child creation preserves continuous inheritance instead of freezing parent defaults', () => {
  const defaults = { name: 'real\\child', leverage: 100, currency: 'USD', symbolsAllowed: ['EURUSD'], groupPurpose: 'coverage' };
  assert.deepEqual(subgroupCreatePayload(defaults, 'real'), { name: 'real\\child', parentGroup: 'real', overriddenFields: [] });
  assert.deepEqual(subgroupCreatePayload({ ...defaults, leverage: 200, symbolsAllowed: ['GBPUSD'] }, 'real', ['leverage', 'symbolsAllowed', 'leverage', 'broker_id']), {
    name: 'real\\child', parentGroup: 'real', overriddenFields: ['leverage', 'symbolsAllowed'], leverage: 200, symbolsAllowed: ['GBPUSD'],
  });
  assert.deepEqual(defaults.symbolsAllowed, ['EURUSD']);
});
test('reset sends only the chosen override and current revision, never an old parent snapshot', () => {
  const child = { parentGroup: 'real', overriddenFields: ['symbolsAllowed'], revision };
  assert.match(groupFieldState(child, 'leverage'), /Inherited from real/);
  assert.equal(groupFieldState(child, 'symbolsAllowed'), 'Override');
  assert.deepEqual(inheritedFieldReset(child, 'symbolsAllowed'), { inheritFields: ['symbolsAllowed'], expected_revision: revision });
  assert.throws(() => inheritedFieldReset({ ...child, revision: '' }, 'symbolsAllowed'), /Reload/);
  assert.throws(() => inheritedFieldReset({ ...child, parentGroup: null }, 'leverage'));
});
test('creation keeps the exact missing-route warning visible without inventing one', () => {
  assert.equal(accountCreationWarning({ login: 7, routing_warning: 'no routing rule found' }), 'no routing rule found');
  assert.equal(accountCreationWarning({ login: 7 }), '');
});
test('write bodies never carry symbolSettings or overriddenFields, even when the parent lookup copied them into the form', () => {
  // The popup copies the parent GroupGet record into formData (symbolSettings, overriddenFields included).
  const form = {
    name: 'real\\root2', currency: 'USD', leverage: 100,
    symbolSettings: [{ groupName: 'real', symbol: 'EURUSD', spreadMarkup: 2, commission: 3.5, swapMultiplier: 1.5 }],
    overriddenFields: ['leverage'],
  };
  // Root create after clearing the parent: no parentGroup, and nothing may leak from the parent.
  assert.deepEqual(groupWriteBody(subgroupCreatePayload(form, '')), { name: 'real\\root2', currency: 'USD', leverage: 100, parentGroup: null });
  // Child create: only the deliberate override is sent.
  assert.deepEqual(groupWriteBody(subgroupCreatePayload({ ...form, leverage: 200 }, 'real', ['leverage'])), {
    name: 'real\\root2', parentGroup: 'real', leverage: 200,
  });
  // Edit (GroupUpdate body): symbolSettings null from GroupList must not reach the body either.
  const update = { name: 'real', leverage: 150, symbolSettings: null, overriddenFields: [] };
  assert.deepEqual(groupWriteBody(update), { name: 'real', leverage: 150 });
  assert.ok('symbolSettings' in update, 'input is not mutated');
  assert.deepEqual(groupWriteBody(null), {});
});

// Loaded records as GroupList returns them (no revision on list rows; GroupGet adds one).
const CHILD = {
  name: 'real\\std-child', parentGroup: 'real', overriddenFields: ['leverage'], revision: 'lcr1:0123456789abcdef01234567',
  description: '', currency: 'USD', leverage: 200, marginCallLevel: 100, stopOutLevel: 50, commissionRate: 0,
  commissionType: 'per_lot', swapMultiplier: 1, spreadMarkup: 0, maxLotPerTrade: 100, maxTotalLots: 500,
  executionMode: 'market', bookType: 'b', routingMode: 'b_book', negativeBalanceProtection: true, tradeAllowed: true,
  demo: false, accountType: 'standard', lotDivisor: 1, symbolsAllowed: ['GBPUSD'], symbolsBlocked: [],
  groupPurpose: 'customer', symbolSettings: null, enabled: true,
};
const ROOT = { ...CHILD, name: 'real', parentGroup: null, overriddenFields: [], revision: undefined };
// What the popup validates from the form: the record copied into form fields, then edits applied.
const formFrom = (record, edits = {}) => buildGroupRiskPayload({
  ...record, symbolsAllowed: record.symbolsAllowed.join(', '), symbolsBlocked: record.symbolsBlocked.join(', '),
  name: record.name, currency: record.currency, ...edits,
});
const inheritedKeys = body => Object.keys(body).filter(key => GROUP_INHERITABLE_FIELDS.includes(key)).sort();

test('edit (1): a subgroup edit of one field sends only that field plus identity; every other inherited key stays inherited', () => {
  const body = groupUpdateBody(formFrom(CHILD, { leverage: 150 }), CHILD);
  assert.deepEqual(inheritedKeys(body), ['leverage']);
  assert.deepEqual(Object.keys(body).sort(), ['expected_revision', 'leverage', 'originalName']);
  assert.equal(body.leverage, 150);
  assert.equal(body.originalName, 'real\\std-child', 'group identity');
  assert.equal(body.expected_revision, CHILD.revision, 'concurrency guard when the record has a revision');
  assert.equal('parentGroup' in body, false, 'an edit never reparents');
});

test('edit (2): a root edit sends only the changed field', () => {
  const body = groupUpdateBody(formFrom(ROOT, { description: 'Main book' }), ROOT);
  assert.deepEqual(inheritedKeys(body), ['description']);
  assert.deepEqual(Object.keys(body).sort(), ['description', 'originalName']);
  assert.equal(body.originalName, 'real');
});

test('edit (3): no changed field returns null, so no GroupUpdate is made; equal-after-normalisation fields are not changes', () => {
  assert.equal(groupUpdateBody(formFrom(CHILD), CHILD), null);
  assert.equal(groupUpdateBody(formFrom(CHILD, { leverage: '200', description: '  ', symbolsAllowed: ' GBPUSD ' }), CHILD), null);
  assert.equal(groupUpdateBody(formFrom(CHILD, { leverage: 201 }), { ...CHILD, leverage: 200 }) !== null, true);
});

test('parentGroup is sent only when the parent actually changed (null and blank are the same root)', () => {
  // Unchanged parent: a plain field edit must not carry parentGroup (its presence is a reparent on the backend).
  const sameParent = groupUpdateBody(formFrom(CHILD, { leverage: 150 }), CHILD);
  assert.equal('parentGroup' in sameParent, false);
  assert.equal(groupUpdateBody(formFrom(CHILD, { parentGroup: 'real' }), CHILD), null, 'no field and no parent change: no call');
  const root = groupUpdateBody(formFrom(ROOT, { description: 'Main' }), ROOT);
  assert.equal('parentGroup' in root, false, 'root with null parent: no key');
  assert.equal(groupUpdateBody(formFrom(ROOT, { parentGroup: '  ', description: 'Main' }), ROOT).parentGroup, undefined, 'blank is still no parent');
  // Changed parent: sent, with the new name.
  const moved = groupUpdateBody(formFrom(CHILD, { parentGroup: 'other' }), CHILD);
  assert.equal(moved.parentGroup, 'other');
  assert.deepEqual(Object.keys(moved).sort(), ['originalName', 'expected_revision', 'parentGroup'].sort());
  // Changed parent to none: sent as null.
  assert.equal(groupUpdateBody(formFrom(CHILD, { parentGroup: '' }), CHILD).parentGroup, null);
});

test('a description change on a subgroup is a plain field update (description is not an override on the backend)', () => {
  const body = groupUpdateBody(formFrom(CHILD, { description: 'Desk B' }), CHILD);
  assert.equal(body.description, 'Desk B');
  assert.deepEqual(Object.keys(body).sort(), ['description', 'expected_revision', 'originalName']);
});

test('quoteFeed and routingRules are never sent, on create or update', () => {
  const validated = { ...formFrom(CHILD, { leverage: 150 }), quoteFeed: 'feed-a', routingRules: [{ id: 1 }] };
  const body = groupUpdateBody(validated, CHILD);
  assert.equal('quoteFeed' in body, false);
  assert.equal('routingRules' in body, false);
  const create = groupCreateBody({ ...validated, name: 'real\\new' }, 'real', ['leverage']);
  assert.equal('quoteFeed' in create, false);
  assert.equal('routingRules' in create, false);
  assert.deepEqual(duplicateOverrideSeed(['quoteFeed', 'routingRules', 'symbolSettings', 'leverage']), ['leverage']);
});

test('edit (5): a bookType edit also sends the derived routingMode (UI-2)', () => {
  const body = groupUpdateBody(formFrom(CHILD, { bookType: 'a' }), CHILD);
  assert.deepEqual(inheritedKeys(body), ['bookType', 'routingMode']);
  assert.equal(body.bookType, 'a');
  assert.equal(body.routingMode, 'a_book');
});

test('sameGroupFieldValue: numeric fields compare as numbers, text fields as trimmed text', () => {
  assert.equal(sameGroupFieldValue(100, '100', 'leverage'), true);
  assert.equal(sameGroupFieldValue(' 1.5 ', 1.5, 'swapMultiplier'), true);
  assert.equal(sameGroupFieldValue(100, 101, 'leverage'), false);
  assert.equal(sameGroupFieldValue('', null, 'leverage'), true);
  assert.equal(sameGroupFieldValue(undefined, '', 'description'), true);
  assert.equal(sameGroupFieldValue(['A', 'B'], ['A', 'B']), true);
  assert.equal(sameGroupFieldValue([], null), true);
  assert.equal(sameGroupFieldValue(['A', 'B'], ['B', 'A']), false, 'symbol lists compare in order');
  assert.equal(sameGroupFieldValue(false, true, 'demo'), false);
  assert.equal(sameGroupFieldValue(true, true, 'demo'), true);
  assert.equal(GROUP_EDIT_FIELDS.includes('symbolSettings'), false);
  assert.equal(GROUP_EDIT_FIELDS.includes('overriddenFields'), false);
});

test('text fields are not coerced to numbers: description "1.0" -> "1" and "007" -> "7" are real changes', () => {
  assert.equal(sameGroupFieldValue('1.0', '1', 'description'), false);
  assert.equal(sameGroupFieldValue('007', '7', 'description'), false);
  assert.equal(sameGroupFieldValue(' 1.0 ', '1.0', 'description'), true, 'trimmed text is still equal');
  assert.equal(groupUpdateBody(formFrom(CHILD, { description: '1' }), { ...CHILD, description: '1.0' }).description, '1');
  assert.equal(groupUpdateBody(formFrom(CHILD, { description: '7' }), { ...CHILD, description: '007' }).description, '7');
  assert.equal(groupUpdateBody(formFrom(CHILD, { description: '1.0' }), { ...CHILD, description: '1.0' }), null);
});

// GroupList row keys (groups.go groupRecord, lines 21-53; none has omitempty except revision).
const GROUP_LIST_KEYS = ['description', 'currency', 'leverage', 'marginCallLevel', 'stopOutLevel', 'commissionRate',
  'commissionType', 'swapMultiplier', 'spreadMarkup', 'maxLotPerTrade', 'maxTotalLots', 'executionMode', 'bookType',
  'negativeBalanceProtection', 'tradeAllowed', 'demo', 'accountType', 'lotDivisor', 'symbolsAllowed', 'symbolsBlocked'];
test('every edit-form field is present in a GroupList row, so skipping undefined never blocks an editable field', () => {
  for (const field of GROUP_EDIT_FIELDS) assert.ok(GROUP_LIST_KEYS.includes(field), `${field} is in groupRecord`);
});

test('a field the loaded record lacks is sent only when the user touched it', () => {
  const lacksDemo = { ...CHILD, demo: undefined };
  assert.equal(groupUpdateBody(formFrom(CHILD, { demo: true }), lacksDemo), null, 'untouched and missing: not sent, so no call');
  const touched = groupUpdateBody(formFrom(CHILD, { demo: true }), lacksDemo, new Set(['demo']));
  assert.equal(touched.demo, true, 'the user changed the control: sent');
});

test('duplicate with a source routingMode override (hybrid): the source value is kept while bookType is unchanged', () => {
  const source = { ...CHILD, bookType: 'b', routingMode: 'hybrid', overriddenFields: ['routingMode'] };
  const validated = formFrom(source, { name: 'real\std-child-copy' });
  assert.equal(validated.routingMode, 'b_book', 'buildGroupRiskPayload derives routingMode from bookType');
  const override = duplicateRoutingOverride(source, validated);
  assert.equal(override, 'hybrid');
  const body = groupCreateBody({ ...validated, routingMode: override }, 'real', duplicateOverrideSeed(source.overriddenFields));
  assert.equal(body.routingMode, 'hybrid');
  assert.deepEqual(inheritedKeys(body), ['routingMode']);
  // A book change derives the routing mode again (UI-2): no override.
  assert.equal(duplicateRoutingOverride(source, formFrom(source, { bookType: 'a' })), undefined);
  // No routingMode override on the source: nothing to keep.
  assert.equal(duplicateRoutingOverride({ ...source, overriddenFields: [] }, validated), undefined);
});

test('duplicate (root): a root keeps its non-derived routingMode (hybrid) while bookType is unchanged, with no override list needed', () => {
  const root = { ...ROOT, bookType: 'b', routingMode: 'hybrid', overriddenFields: [] };
  const validated = formFrom(root, { name: 'real-copy' });
  assert.equal(validated.routingMode, 'b_book', 'buildGroupRiskPayload derives routingMode from bookType');
  assert.equal(duplicateRoutingOverride(root, validated), 'hybrid');
  // Root body: the kept routingMode is what is sent, with parentGroup null and no override keys.
  const body = groupCreateBody({ ...validated, routingMode: duplicateRoutingOverride(root, validated) }, '', []);
  assert.equal(body.routingMode, 'hybrid');
  assert.equal(body.parentGroup, null);
  assert.equal('overriddenFields' in body, false);
  // The source's routingMode already equals the derived value: nothing to keep.
  assert.equal(duplicateRoutingOverride({ ...root, routingMode: 'b_book' }, validated), undefined);
  // A book change on the copy derives the routing mode again (UI-2).
  assert.equal(duplicateRoutingOverride(root, formFrom(root, { name: 'real-copy', bookType: 'a' })), undefined);
  // Root with an a-book source: a non-derived value is kept the same way.
  const rootA = { ...ROOT, bookType: 'a', routingMode: 'hybrid', overriddenFields: [] };
  assert.equal(duplicateRoutingOverride(rootA, formFrom(rootA, { name: 'real-copy-a' })), 'hybrid');
  // No routingMode on the source at all: nothing to keep.
  assert.equal(duplicateRoutingOverride({ ...root, routingMode: '' }, validated), undefined);
});
test('duplicate (4): a subgroup duplicate sends parentGroup and exactly the source overrides, nothing else inheritable', () => {
  // The source's overriddenFields may list write-excluded keys; the seed keeps only creatable overrides.
  const source = { ...CHILD, overriddenFields: ['leverage', 'symbolsAllowed', 'symbolSettings', 'quoteFeed'], leverage: 200, symbolsAllowed: ['EURUSD'] };
  const validated = formFrom(source, { name: 'real\\std-child-copy' });
  const body = groupCreateBody(validated, source.parentGroup, duplicateOverrideSeed(source.overriddenFields));
  assert.deepEqual(inheritedKeys(body), ['leverage', 'symbolsAllowed']);
  assert.equal(body.parentGroup, 'real');
  assert.equal(body.leverage, 200);
  assert.deepEqual(body.symbolsAllowed, ['EURUSD']);
  assert.equal('overriddenFields' in body, false, 'overriddenFields is never sent');
  assert.equal('symbolSettings' in body, false);
  // Root duplicates are unchanged: every field, parentGroup null, no overrides list.
  const rootBody = groupCreateBody(formFrom(ROOT, { name: 'real-copy' }), '', []);
  assert.equal(rootBody.parentGroup, null);
  assert.equal(rootBody.description, '');
  assert.equal('overriddenFields' in rootBody, false);
});

test('expected_revision: sent only as a valid lcr1 revision; an empty or invalid one is omitted, never sent as a key', () => {
  const valid = groupUpdateBody(formFrom(CHILD, { leverage: 150 }), CHILD);
  assert.equal(valid.expected_revision, CHILD.revision, 'valid revision: key present');
  const empty = groupUpdateBody(formFrom(CHILD, { leverage: 150 }), { ...CHILD, revision: '' });
  assert.equal('expected_revision' in empty, false, 'empty revision: key absent');
  const bad = groupUpdateBody(formFrom(CHILD, { leverage: 150 }), { ...CHILD, revision: 'lcr1:ABC' });
  assert.equal('expected_revision' in bad, false, 'malformed revision: key absent');
  const none = groupUpdateBody(formFrom(CHILD, { leverage: 150 }), { ...CHILD, revision: undefined });
  assert.equal('expected_revision' in none, false, 'no revision on the record (GroupList rows): key absent');
});
