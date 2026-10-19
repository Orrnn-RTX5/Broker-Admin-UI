// UI-2 regression: Admin bookType owns the Manager routingMode contract value.
// Run with: node --test src/utils/groupBookRouting.test.js
// Uses only unit/contract fixtures and a fake ManagerService.createGroup;
// no live production mutations.
import test from 'node:test';
import assert from 'node:assert/strict';

import { bookTypeToRoutingMode, buildGroupRiskPayload } from './adminValidation.js';
import { subgroupCreatePayload } from './groupAuthority.js';

const baseForm = (overrides = {}) => ({
  name: 'fixture-group',
  currency: 'USD',
  bookType: 'b',
  commissionRate: 0,
  leverage: 100,
  lotDivisor: 1,
  marginCallLevel: 100,
  maxLotPerTrade: 100,
  maxTotalLots: 500,
  spreadMarkup: 0,
  stopOutLevel: 50,
  swapMultiplier: 1,
  symbolsAllowed: '',
  symbolsBlocked: '',
  ...overrides,
});

// Same payload path as CreateGroupPopup.handleSubmit (create branch).
const popupCreatePayload = (formData, parentGroup, changedFields) => {
  const validated = buildGroupRiskPayload({ ...formData });
  const changed = [...new Set([...changedFields, ...(changedFields.includes('bookType') ? ['routingMode'] : [])])];
  return subgroupCreatePayload(validated, (parentGroup || '').trim(), changed);
};

test('UI-2: A-book selection emits routingMode a_book through the popup payload path', async () => {
  const sent = [];
  const FakeManagerService = { createGroup: async (payload) => { sent.push(payload); return { ok: true }; } };
  const payload = popupCreatePayload(baseForm({ bookType: 'a' }), '', ['bookType']);
  await FakeManagerService.createGroup(payload);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].bookType, 'a');
  assert.equal(sent[0].routingMode, 'a_book');
});

test('UI-2: B-book selection emits routingMode b_book through the popup payload path', async () => {
  const sent = [];
  const FakeManagerService = { createGroup: async (payload) => { sent.push(payload); return { ok: true }; } };
  const payload = popupCreatePayload(baseForm({ bookType: 'b' }), '', ['bookType']);
  await FakeManagerService.createGroup(payload);
  assert.equal(sent[0].routingMode, 'b_book');
});

test('UI-2: update path (initialData) keeps the derived routingMode', () => {
  const validated = buildGroupRiskPayload(baseForm({ bookType: 'a' }));
  assert.equal(validated.routingMode, 'a_book');
  const validatedB = buildGroupRiskPayload(baseForm({ bookType: 'b' }));
  assert.equal(validatedB.routingMode, 'b_book');
});

test('UI-2: subgroup bookType override always carries routingMode (no stale inheritance)', () => {
  const payload = popupCreatePayload(baseForm({ bookType: 'a' }), 'parent-group', ['bookType']);
  assert.deepEqual(payload.overriddenFields.sort(), ['bookType', 'routingMode'].sort());
  assert.equal(payload.routingMode, 'a_book');
  assert.equal(payload.bookType, 'a');
});

test('UI-2: subgroup without a book change sends no routing override (inheritance preserved)', () => {
  const payload = popupCreatePayload(baseForm({ bookType: 'b' }), 'parent-group', ['leverage']);
  assert.deepEqual(payload.overriddenFields, ['leverage']);
  assert.equal(Object.hasOwn(payload, 'routingMode'), false);
});

test('UI-2: unspecified/invalid bookType cannot silently become B-book', () => {
  // An explicit prior routingMode is preserved, never silently flipped.
  assert.equal(bookTypeToRoutingMode(undefined, 'a_book'), 'a_book');
  assert.equal(bookTypeToRoutingMode('', 'a_book'), 'a_book');
  assert.equal(bookTypeToRoutingMode('bogus', 'a_book'), 'a_book');
  assert.equal(bookTypeToRoutingMode(undefined, 'b_book'), 'b_book');
  // With no prior mode the UI sends the backend-documented neutral default
  // explicitly (Manager normalizes empty routingMode to b_book), so the
  // default is visible in the payload instead of relying on silent backend
  // normalization.
  assert.equal(bookTypeToRoutingMode(undefined, undefined), 'b_book');
  assert.equal(bookTypeToRoutingMode('', undefined), 'b_book');
  assert.equal(bookTypeToRoutingMode('bogus', undefined), 'b_book');
  const payload = buildGroupRiskPayload(baseForm({ bookType: undefined, routingMode: undefined }));
  assert.equal(payload.routingMode, 'b_book');
});
