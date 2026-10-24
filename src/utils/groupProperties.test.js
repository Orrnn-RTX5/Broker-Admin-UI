// Run with: node --test src/utils/groupProperties.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addGroupSymbolRow,
  buildCommissionSchedulePayload,
  buildGroupSymbolsSavePayload,
  buildMarginChanges,
  copyDuplicateSymbolTerms,
  planDuplicateSymbolTerms,
  unapprovedSymbolTerms,
  buildMarginForm,
  commissionFormFromSchedule,
  findGroupRecord,
  createGroupSymbolRow,
  describeAccountsUpdated,
  emptyCommissionForm,
  filterSchedulesForGroup,
  formatCommissionType,
  formatScheduleTime,
  getGroupName,
  groupSymbolEditForm,
  isGroupSymbolListDirty,
  isMarginFormDirty,
  moveGroupSymbolRow,
  normalizeGroupSymbolsResponse,
  rebaseMarginForm,
  removeGroupSymbolRow,
  updateGroupSymbolRow,
  validateGroupSymbolEdit,
  validateMarginForm,
} from './groupProperties.js';

const GROUP = {
  name: 'real\\standard',
  group: 'real\\standard',
  executionMode: 'market',
  marginCallLevel: 100,
  stopOutLevel: 50,
  negativeBalanceProtection: true,
  symbolsAllowed: ['EURUSD'],
};

// ---------------------------------------------------------------- Margin

test('buildMarginForm reads the four supported fields from the group row', () => {
  assert.deepEqual(buildMarginForm(GROUP), {
    executionMode: 'market',
    marginCallLevel: '100',
    stopOutLevel: '50',
    negativeBalanceProtection: true,
  });
  assert.equal(buildMarginForm({ risk: 'Instant' }).executionMode, 'instant');
  assert.equal(buildMarginForm({}).negativeBalanceProtection, false);
  assert.equal(getGroupName({ name: 'demo\\a' }), 'demo\\a');
});

test('validateMarginForm requires non-negative levels and stop out <= margin call', () => {
  const ok = validateMarginForm({ executionMode: 'instant', marginCallLevel: '80', stopOutLevel: '80', negativeBalanceProtection: false });
  assert.deepEqual(ok.errors, {});
  assert.deepEqual(ok.values, { executionMode: 'instant', marginCallLevel: 80, stopOutLevel: 80, negativeBalanceProtection: false });

  assert.match(validateMarginForm({ executionMode: 'market', marginCallLevel: '50', stopOutLevel: '60' }).errors.stopOutLevel, /less than or equal/);
  assert.match(validateMarginForm({ executionMode: 'market', marginCallLevel: '-1', stopOutLevel: '0' }).errors.marginCallLevel, /0 or greater/);
  assert.match(validateMarginForm({ executionMode: 'market', marginCallLevel: '', stopOutLevel: '0' }).errors.marginCallLevel, /required/);
  assert.match(validateMarginForm({ executionMode: 'market', marginCallLevel: '10', stopOutLevel: 'abc' }).errors.stopOutLevel, /number/);
  assert.ok(validateMarginForm({ executionMode: 'hybrid', marginCallLevel: '1', stopOutLevel: '1' }).errors.executionMode);
});

test('buildMarginChanges returns only changed fields, parsed', () => {
  const initial = buildMarginForm(GROUP);
  assert.deepEqual(buildMarginChanges(initial, initial), { changes: {}, errors: {} });
  // "100.0" parses to the same number: no effective change.
  assert.deepEqual(buildMarginChanges(initial, { ...initial, marginCallLevel: '100.0' }).changes, {});

  const { changes } = buildMarginChanges(initial, { ...initial, stopOutLevel: '30', negativeBalanceProtection: false });
  assert.deepEqual(changes, { stopOutLevel: 30, negativeBalanceProtection: false });
  assert.equal('symbolsAllowed' in changes, false);

  const invalid = buildMarginChanges(initial, { ...initial, stopOutLevel: '150' });
  assert.deepEqual(invalid.changes, {});
  assert.ok(invalid.errors.stopOutLevel);
});

test('isMarginFormDirty compares the raw form', () => {
  const initial = buildMarginForm(GROUP);
  assert.equal(isMarginFormDirty(initial, { ...initial }), false);
  assert.equal(isMarginFormDirty(initial, { ...initial, executionMode: 'instant' }), true);
  assert.equal(isMarginFormDirty(initial, { ...initial, negativeBalanceProtection: false }), true);
});

test('rebaseMarginForm keeps the admin edits and takes fresh values for untouched fields', () => {
  const before = buildMarginForm(GROUP);
  const edited = { ...before, stopOutLevel: '30' };
  // Someone else changed the margin call level and execution mode meanwhile.
  const fresh = buildMarginForm({ ...GROUP, marginCallLevel: 120, executionMode: 'instant' });
  const rebased = rebaseMarginForm(before, edited, fresh);
  assert.deepEqual(rebased, { executionMode: 'instant', marginCallLevel: '120', stopOutLevel: '30', negativeBalanceProtection: true });
  // Only the admin's own edit is sent on the next OK.
  assert.deepEqual(buildMarginChanges(fresh, rebased).changes, { stopOutLevel: 30 });
  // No edits: the form simply becomes the fresh group.
  assert.deepEqual(rebaseMarginForm(before, before, fresh), fresh);
});

test('describeAccountsUpdated reports accounts_updated when present', () => {
  assert.equal(describeAccountsUpdated({ accounts_updated: 3 }), 'Margin settings applied to 3 accounts.');
  assert.equal(describeAccountsUpdated({ accounts_updated: 1 }), 'Margin settings applied to 1 account.');
  assert.equal(describeAccountsUpdated({ accounts_updated: 0 }), 'Margin settings applied to 0 accounts.');
  assert.equal(describeAccountsUpdated({ status: 'ok' }), '');
  assert.equal(describeAccountsUpdated(null), '');
});

// ---------------------------------------------------------------- Symbols

const SYMBOLS_RESPONSE = {
  group: 'real\\standard',
  unrestricted: false,
  symbols: [
    { symbol: 'EURUSD', spread_markup: 2, commission: 3.5, swap_multiplier: 1.5, trade_allowed: true, configured: true },
    { symbol: 'XAUUSD', spread_markup: '4', commission: '0', swap_multiplier: null, trade_allowed: false, configured: false },
    { symbol: 'eurusd', spread_markup: 9 },
    { symbol: '' },
  ],
  blocked: [],
};

test('normalizeGroupSymbolsResponse keeps order, coerces values, drops blanks/duplicates', () => {
  const { rows, unrestricted, blocked } = normalizeGroupSymbolsResponse(SYMBOLS_RESPONSE);
  assert.equal(unrestricted, false);
  assert.deepEqual(blocked, []);
  assert.deepEqual(rows, [
    { symbol: 'EURUSD', spread_markup: 2, commission: 3.5, swap_multiplier: 1.5, trade_allowed: true, configured: true, persisted: true },
    { symbol: 'XAUUSD', spread_markup: 4, commission: 0, swap_multiplier: 1, trade_allowed: false, configured: false, persisted: true },
  ]);

  const empty = normalizeGroupSymbolsResponse({ group: 'x', unrestricted: true, symbols: [], blocked: [] });
  assert.deepEqual(empty.rows, []);
  assert.equal(empty.unrestricted, true);
  assert.equal(normalizeGroupSymbolsResponse(undefined).unrestricted, true);
});

test('addGroupSymbolRow appends a default row and rejects empty/duplicate symbols', () => {
  const { rows } = normalizeGroupSymbolsResponse(SYMBOLS_RESPONSE);
  const next = addGroupSymbolRow(rows, ' GBPUSD ', { configured: false });
  assert.equal(next.length, 3);
  assert.deepEqual(next[2], { symbol: 'GBPUSD', spread_markup: 0, commission: 0, swap_multiplier: 1, trade_allowed: true, configured: false, persisted: false });
  assert.equal(rows.length, 2, 'input list is not mutated');

  assert.throws(() => addGroupSymbolRow(rows, 'xauusd'), /already in the list/);
  assert.throws(() => addGroupSymbolRow(rows, '  '), /Enter a symbol/);
  assert.equal(createGroupSymbolRow('US30').configured, true);
});

test('removeGroupSymbolRow / moveGroupSymbolRow', () => {
  const rows = ['A', 'B', 'C'].map((symbol) => createGroupSymbolRow(symbol));
  assert.deepEqual(removeGroupSymbolRow(rows, 1).map((r) => r.symbol), ['A', 'C']);

  const down = moveGroupSymbolRow(rows, 0, 1);
  assert.deepEqual(down.rows.map((r) => r.symbol), ['B', 'A', 'C']);
  assert.equal(down.index, 1);

  const up = moveGroupSymbolRow(rows, 2, -1);
  assert.deepEqual(up.rows.map((r) => r.symbol), ['A', 'C', 'B']);
  assert.equal(up.index, 1);

  assert.equal(moveGroupSymbolRow(rows, 0, -1).rows, rows);
  assert.equal(moveGroupSymbolRow(rows, 2, 1).index, 2);
  assert.equal(moveGroupSymbolRow(rows, -1, 1).rows, rows);
});

test('validateGroupSymbolEdit enforces integer spread and non-negative numbers', () => {
  const row = createGroupSymbolRow('EURUSD');
  const form = groupSymbolEditForm(row);
  assert.deepEqual(form, { spread_markup: '0', commission: '0', swap_multiplier: '1', trade_allowed: true });

  const ok = validateGroupSymbolEdit({ spread_markup: '3', commission: '2.5', swap_multiplier: '0', trade_allowed: false });
  assert.deepEqual(ok.errors, {});
  assert.deepEqual(ok.values, { spread_markup: 3, commission: 2.5, swap_multiplier: 0, trade_allowed: false });

  const bad = validateGroupSymbolEdit({ spread_markup: '1.5', commission: '-1', swap_multiplier: '' });
  assert.match(bad.errors.spread_markup, /whole number/);
  assert.match(bad.errors.commission, /0 or greater/);
  assert.match(bad.errors.swap_multiplier, /required/);
});

test('updateGroupSymbolRow + dirty detection + save payload', () => {
  const { rows: baseline } = normalizeGroupSymbolsResponse(SYMBOLS_RESPONSE);
  assert.equal(isGroupSymbolListDirty(baseline, [...baseline]), false);

  const edited = updateGroupSymbolRow(baseline, 0, { spread_markup: 5 });
  assert.equal(edited[0].spread_markup, 5);
  assert.equal(baseline[0].spread_markup, 2, 'input list is not mutated');
  assert.equal(isGroupSymbolListDirty(baseline, edited), true);

  assert.equal(isGroupSymbolListDirty(baseline, moveGroupSymbolRow(baseline, 0, 1).rows), true, 'order matters');
  assert.equal(isGroupSymbolListDirty(baseline, removeGroupSymbolRow(baseline, 0)), true);
  assert.equal(isGroupSymbolListDirty(baseline, updateGroupSymbolRow(baseline, 0, { spread_markup: 2 })), false);

  assert.deepEqual(buildGroupSymbolsSavePayload('real\\standard', edited), {
    group: 'real\\standard',
    symbols: [
      { symbol: 'EURUSD', spread_markup: 5, commission: 3.5, swap_multiplier: 1.5, trade_allowed: true },
      { symbol: 'XAUUSD', spread_markup: 4, commission: 0, swap_multiplier: 1, trade_allowed: false },
    ],
  });
  assert.deepEqual(buildGroupSymbolsSavePayload('g', []), { group: 'g', symbols: [] }, 'empty list = unrestricted');
});

const DUPLICATE_SOURCE = { unrestricted: false, blocked: [], symbols: [
  { symbol: 'EURUSD', spread_markup: 2, commission: 3.5, swap_multiplier: 1.5, trade_allowed: true, configured: true },
  { symbol: 'XAUUSD', spread_markup: 0, commission: 0, swap_multiplier: 1, trade_allowed: false, configured: true },
  { symbol: 'GBPUSD', spread_markup: 0, commission: 0, swap_multiplier: 1, trade_allowed: true, configured: false },
] };

test('duplicate: the copy plan carries all four terms per row, follows the new group list, and never widens it', () => {
  // The user dropped GBPUSD and added USDJPY (no source terms) while duplicating.
  assert.deepEqual(planDuplicateSymbolTerms(DUPLICATE_SOURCE, ['USDJPY', 'xauusd', 'EURUSD']), { status: 'copy', rows: [
    { symbol: 'USDJPY', spread_markup: 0, commission: 0, swap_multiplier: 1, trade_allowed: true },
    { symbol: 'XAUUSD', spread_markup: 0, commission: 0, swap_multiplier: 1, trade_allowed: false },
    { symbol: 'EURUSD', spread_markup: 2, commission: 3.5, swap_multiplier: 1.5, trade_allowed: true },
  ] });
});

test('duplicate: no plan when the source has only default terms or no source terms at all', () => {
  const defaults = { symbols: [{ symbol: 'EURUSD', spread_markup: 0, commission: 0, swap_multiplier: 1, trade_allowed: true }] };
  assert.deepEqual(planDuplicateSymbolTerms(defaults, ['EURUSD']), { status: 'none' });
  assert.deepEqual(planDuplicateSymbolTerms({ symbols: [], unrestricted: true }, ['EURUSD']), { status: 'none' });
  assert.deepEqual(planDuplicateSymbolTerms(undefined, ['EURUSD']), { status: 'none' });
});

test('duplicate: a source with terms but an unrestricted new group reports unrestricted (not a silent no-op)', () => {
  assert.deepEqual(planDuplicateSymbolTerms(DUPLICATE_SOURCE, []), { status: 'unrestricted' });
  assert.deepEqual(planDuplicateSymbolTerms(DUPLICATE_SOURCE, ['  ', '']), { status: 'unrestricted' });
});

const REVISION = 'lcr1:0123456789abcdef01234567';
const APPROVED_ANSWER = { calculation_approval: { symbols: [{ symbol: 'EURUSD', state: 'approved', approved: true }] } };
test('duplicate: copy reads the NEW group revision and saves the rows with it', async () => {
  const reads = [];
  const saves = [];
  const api = {
    read: async (group) => { reads.push(group); return { group, revision: REVISION, symbols: [] }; },
    save: async (group, rows, revision) => { saves.push({ group, rows, revision }); return APPROVED_ANSWER; },
  };
  assert.deepEqual(await copyDuplicateSymbolTerms(api, 'real\copy', DUPLICATE_SOURCE, ['EURUSD']), { status: 'copy', unapproved: null });
  assert.deepEqual(reads, ['real\copy']);
  assert.equal(saves.length, 1);
  assert.equal(saves[0].group, 'real\copy');
  assert.equal(saves[0].revision, REVISION, 'the save carries the revision read from the new group');
  for (const row of saves[0].rows) {
    assert.deepEqual(Object.keys(row).sort(), ['commission', 'spread_markup', 'swap_multiplier', 'symbol', 'trade_allowed']);
  }
});

test('duplicate: an empty or invalid revision is omitted (key absent, never empty), a valid one is passed through', async () => {
  const seen = [];
  let current = {};
  const api = { read: async () => current, save: async (group, rows, revision) => { seen.push(revision); return APPROVED_ANSWER; } };
  for (const revision of ['', 'lcr1:xyz', 'lcr1:0123456789ABCDEF01234567', null, undefined]) {
    current = { revision };
    await copyDuplicateSymbolTerms(api, 'g', DUPLICATE_SOURCE, ['EURUSD']);
  }
  assert.deepEqual(seen, [undefined, undefined, undefined, undefined, undefined], 'no key is sent without a valid revision');
  current = { revision: REVISION };
  await copyDuplicateSymbolTerms(api, 'g', DUPLICATE_SOURCE, ['EURUSD']);
  assert.equal(seen.at(-1), REVISION, 'a valid revision is passed through');
});

test('duplicate: nothing is read or saved when there is no copy, and failures reach the caller', async () => {
  let calls = 0;
  const api = { read: async () => { calls += 1; return {}; }, save: async () => { calls += 1; return APPROVED_ANSWER; } };
  assert.deepEqual(await copyDuplicateSymbolTerms(api, 'g', { symbols: [] }, ['EURUSD']), { status: 'none', unapproved: null });
  assert.deepEqual(await copyDuplicateSymbolTerms(api, 'g', DUPLICATE_SOURCE, []), { status: 'unrestricted', unapproved: null });
  assert.equal(calls, 0);
  await assert.rejects(copyDuplicateSymbolTerms({ read: async () => { throw new Error('group not visible'); }, save: async () => { calls += 1; } }, 'g', DUPLICATE_SOURCE, ['EURUSD']), /group not visible/);
  await assert.rejects(copyDuplicateSymbolTerms({ read: async () => ({}), save: async () => { throw new Error('symbol not in catalogue'); } }, 'g', DUPLICATE_SOURCE, ['EURUSD']), /symbol not in catalogue/);
  assert.equal(calls, 0, 'a failed read never reaches the save');
});

test('duplicate: refused and not-queued calculation approvals are reported by symbol; queued and approved are not warnings', async () => {
  const answer = { calculation_approval: { outcome: 'mixed', symbols: [
    { symbol: 'EURUSD', state: 'approved', approved: true },
    { symbol: 'GBPUSD', state: 'refused', approved: false, reason: 'CALCULATION_GATE_NO_SESSION' },
    { symbol: 'USDJPY', state: 'not_queued', approved: false, reason: 'APPROVAL_QUEUE_FULL' },
    { symbol: 'XAUUSD', state: 'queued', approved: false, reason: 'APPROVAL_QUEUED' },
  ] } };
  const api = { read: async () => ({}), save: async () => answer };
  const outcome = await copyDuplicateSymbolTerms(api, 'g', DUPLICATE_SOURCE, ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD']);
  assert.deepEqual(outcome.unapproved, { symbols: ['GBPUSD', 'USDJPY'], reason: 'CALCULATION_GATE_NO_SESSION, APPROVAL_QUEUE_FULL' });
  assert.equal(unapprovedSymbolTerms(APPROVED_ANSWER), null);
  assert.equal(unapprovedSymbolTerms({ calculation_approval: { symbols: [{ symbol: 'XAUUSD', state: 'queued', reason: 'APPROVAL_QUEUED' }] } }), null);
  assert.equal(unapprovedSymbolTerms(undefined), null, 'an answer without calculation_approval is not a warning');
});

// ------------------------------------------------------------ Commissions

const SCHEDULE = {
  id: 7,
  name: 'EURUSD std',
  symbol: 'EURUSD',
  group_name: 'real\\standard',
  commission_type: 'percentage',
  value: 0.05,
  min_volume: 0.01,
  max_volume: 100,
  time_from: '08:00:00',
  time_to: '17:30:00',
  enabled: false,
};

test('filterSchedulesForGroup keeps only the dialog group', () => {
  const list = [SCHEDULE, { ...SCHEDULE, id: 8, group_name: 'demo\\x' }, { ...SCHEDULE, id: 9, group_name: '' }];
  assert.deepEqual(filterSchedulesForGroup(list, 'real\\standard').map((r) => r.id), [7]);
  assert.deepEqual(filterSchedulesForGroup(null, 'x'), []);
});

test('formatScheduleTime handles strings, pgx time objects and nulls', () => {
  assert.equal(formatScheduleTime('08:00:00'), '08:00');
  assert.equal(formatScheduleTime('8:05'), '08:05');
  assert.equal(formatScheduleTime({ Microseconds: (17 * 60 + 30) * 60e6, Valid: true }), '17:30');
  assert.equal(formatScheduleTime({ Microseconds: 0, Valid: false }), '');
  assert.equal(formatScheduleTime(null), '');
  assert.equal(formatCommissionType('flat'), 'Flat');
  assert.equal(formatCommissionType('custom'), 'custom');
});

test('emptyCommissionForm has neutral defaults (no hardcoded symbol/value)', () => {
  const form = emptyCommissionForm();
  assert.equal(form.name, '');
  assert.equal(form.symbol, '');
  assert.equal(form.value, '');
  assert.equal(form.commission_type, 'per_lot');
  assert.equal('group_name' in form, false, 'group comes from the dialog, not the form');
});

test('buildCommissionSchedulePayload builds create and update bodies', () => {
  const create = buildCommissionSchedulePayload(
    { ...emptyCommissionForm(), name: ' Gold ', symbol: 'XAUUSD', commission_type: 'flat', value: '4', max_volume: '50' },
    'real\\standard'
  );
  assert.deepEqual(create, {
    name: 'Gold',
    symbol: 'XAUUSD',
    group_name: 'real\\standard',
    commission_type: 'flat',
    value: 4,
    min_volume: 0,
    max_volume: 50,
    time_from: '',
    time_to: '',
  });

  const form = commissionFormFromSchedule(SCHEDULE);
  assert.deepEqual(form, {
    name: 'EURUSD std', symbol: 'EURUSD', commission_type: 'percentage', value: '0.05',
    min_volume: '0.01', max_volume: '100', time_from: '08:00', time_to: '17:30', enabled: false,
  });
  const update = buildCommissionSchedulePayload({ ...form, enabled: true }, 'real\\standard', { id: '7' });
  assert.deepEqual(update, {
    id: 7,
    name: 'EURUSD std',
    symbol: 'EURUSD',
    group_name: 'real\\standard',
    commission_type: 'percentage',
    value: 0.05,
    min_volume: 0.01,
    max_volume: 100,
    time_from: '08:00',
    time_to: '17:30',
    enabled: true,
  });
});

test('buildCommissionSchedulePayload rejects invalid input', () => {
  const base = { ...emptyCommissionForm(), name: 'n', symbol: 'EURUSD', value: '1', max_volume: '10' };
  assert.throws(() => buildCommissionSchedulePayload({ ...base, name: ' ' }, 'g'), /Name is required/);
  assert.throws(() => buildCommissionSchedulePayload({ ...base, symbol: '' }, 'g'), /Symbol is required/);
  assert.throws(() => buildCommissionSchedulePayload(base, ''), /Group is required/);
  assert.throws(() => buildCommissionSchedulePayload({ ...base, commission_type: 'standard' }, 'g'), /commission type/);
  assert.throws(() => buildCommissionSchedulePayload({ ...base, value: '' }, 'g'), /Value is required/);
  assert.throws(() => buildCommissionSchedulePayload({ ...base, value: '-2' }, 'g'), /Value must be 0 or greater/);
  assert.throws(() => buildCommissionSchedulePayload({ ...base, max_volume: '' }, 'g'), /Max volume is required/);
  assert.throws(() => buildCommissionSchedulePayload({ ...base, min_volume: '20' }, 'g'), /greater than or equal to min volume/);
  assert.throws(() => buildCommissionSchedulePayload({ ...base, max_volume: '0' }, 'g'), /greater than 0/);
  assert.throws(() => buildCommissionSchedulePayload({ ...base, time_from: '09:00' }, 'g'), /both/);
  assert.throws(() => buildCommissionSchedulePayload({ ...base, time_from: '25:00', time_to: '26:00' }, 'g'), /HH:MM/);
});

test('symbolCategoryOptions groups symbols by category and counts what can still be added', async () => {
  const { symbolCategoryOptions } = await import('./groupProperties.js');
  const options = symbolCategoryOptions([
    { symbol: 'EURUSD', category: 'Forex', configured: true },
    { symbol: 'GBPUSD', category: 'Forex', configured: true },
    { symbol: 'EURUSD.PRO', category: 'Bidyut_Symbols', configured: true },
    { symbol: 'US30', category: '', configured: false },
  ], ['eurusd']);
  assert.deepEqual(options.map((o) => [o.category, o.symbols.length, o.addable]), [
    ['Bidyut_Symbols', 1, 1],
    ['Forex', 2, 1],
    ['Others', 1, 1],
  ]);
  assert.equal(options[2].symbols[0].configured, false);
});

test('addGroupSymbolRows appends only symbols that are not listed yet', async () => {
  const { addGroupSymbolRows, createGroupSymbolRow } = await import('./groupProperties.js');
  const { rows, added } = addGroupSymbolRows(
    [createGroupSymbolRow('EURUSD')],
    [{ symbol: 'eurusd' }, { symbol: 'GBPUSD' }, { symbol: 'GBPUSD' }, { symbol: 'US30', configured: false }],
  );
  assert.equal(added, 2);
  assert.deepEqual(rows.map((r) => [r.symbol, r.configured]), [['EURUSD', true], ['GBPUSD', true], ['US30', false]]);
});

test('findGroupRecord matches the server group by any name key, ignoring case', () => {
  const rows = [
    { name: 'dipannita', marginCallLevel: 100 },
    { group: 'Orrnn/demo-std', marginCallLevel: 80, stopOutLevel: 50 },
  ];
  assert.equal(findGroupRecord(rows, 'orrnn/demo-std'), rows[1]);
  assert.equal(findGroupRecord(rows, ' Dipannita '), rows[0]);
  assert.equal(findGroupRecord(rows, 'missing'), null);
  assert.equal(findGroupRecord(rows, ''), null);
  assert.equal(findGroupRecord(null, 'dipannita'), null);
});
