import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BULK_BATCH_SIZE,
  MAX_BULK_SYMBOLS,
  buildBulkConfigureRequest,
  bulkTemplateForm,
  chunkSymbols,
  mergeBulkResponses,
  replaceBulkResults,
  timedOutSymbols,
  summarizeBulkResults,
  symbolsToCreate,
  weekdaySessions,
} from './bulkConfigure.js';

// Generic placeholder symbols only; no broker or tenant values.
const form = () => ({
  ...bulkTemplateForm(''),
  category: 'Cat1',
  calc_mode: 'forex',
  contract_size: '100000',
  volume_step: '0.01',
  min_volume: '0.01',
  max_volume: '50.00',
  timezone: 'UTC',
  margin_rate: '1',
  swap_long: '-1.25',
  swap_short: '0.40',
  swap_rollover_3days: '3',
});

test('template form starts with generic defaults and weekday sessions', () => {
  const start = bulkTemplateForm('');
  assert.equal(start.timezone, 'UTC');
  assert.equal(start.swap_long, '', 'swaps are never invented');
  assert.equal(start.swap_rollover_3days, '');
  assert.equal('margin_initial' in start, false, 'margin overrides are not editable (v1.3: only "0")');
  assert.equal(start.sessions.length, 5);
  assert.deepEqual(start.sessions.map((s) => s.day_of_week), [1, 2, 3, 4, 5]);
  assert.equal(weekdaySessions()[0].trade_to, '24:00');
  const crypto = bulkTemplateForm('Crypto');
  assert.equal(crypto.calc_mode, 'cfd_leverage');
  assert.equal(crypto.sessions.length, 7);
});

test('request keeps decimal strings exactly, sends trade_mode full and drops empty overrides', () => {
  const body = buildBulkConfigureRequest({
    symbols: ['AAA1', ' BBB2 ', 'AAA1', ''],
    form: form(),
    perSymbol: {
      AAA1: { digits: '', tick_size: '  ', margin_currency: '' },
      BBB2: { digits: '3', tick_size: '0.001', profit_currency: 'usd', calc_mode: 'cfd_leverage', contract_size: '1' },
    },
    dryRun: true,
  });
  assert.equal(body.dry_run, true);
  assert.deepEqual(body.symbols, ['AAA1', 'BBB2']);
  assert.equal(body.template.max_volume, '50.00', 'the typed decimal is sent unchanged');
  assert.equal(body.template.contract_size, '100000');
  assert.equal(body.template.trade_mode, 'full');
  assert.equal(body.template.timezone, 'UTC');
  assert.equal(body.template.category, 'Cat1', 'v1.4: category is sent');
  assert.equal(body.template.margin_rate, '1');
  assert.equal(body.template.swap_long, '-1.25', 'negative swaps are kept exactly');
  assert.equal(body.template.swap_short, '0.40');
  assert.equal(body.template.swap_rollover_3days, '3');
  assert.deepEqual([body.template.margin_initial, body.template.margin_maintenance, body.template.margin_hedged], ['0', '0', '0']);
  assert.deepEqual(body.template.sessions[0], { day_of_week: 1, quote_from: '00:00', quote_to: '24:00', trade_from: '00:00', trade_to: '24:00' });
  assert.deepEqual(body.per_symbol, { BBB2: { digits: 3, tick_size: '0.001', profit_currency: 'USD', calc_mode: 'cfd_leverage', contract_size: '1' } });
  assert.equal(buildBulkConfigureRequest({ symbols: ['AAA1'], form: form() }).dry_run, false);
});

test('every template refusal names the problem', () => {
  const refuse = (patch, pattern) => assert.throws(() => buildBulkConfigureRequest({ symbols: ['AAA1'], form: { ...form(), ...patch } }), pattern);
  refuse({ calc_mode: '' }, /calculation mode/);
  refuse({ category: '  ' }, /Select a category/);
  refuse({ contract_size: '0' }, /Contract size must be a positive/);
  refuse({ contract_size: '1e5' }, /Contract size/);
  refuse({ volume_step: '-1' }, /Volume step/);
  refuse({ min_volume: '10', max_volume: '9.5' }, /cannot exceed/);
  refuse({ timezone: 'Mars/Base' }, /valid timezone/);
  refuse({ timezone: '' }, /valid timezone/);
  refuse({ margin_rate: '' }, /Margin rate/);
  refuse({ margin_rate: '-1' }, /Margin rate/);
  refuse({ swap_long: '' }, /Swap long is required/);
  refuse({ swap_short: '1,5' }, /Swap short is required/);
  refuse({ swap_rollover_3days: '' }, /triple-swap day/);
  refuse({ swap_rollover_3days: '7' }, /triple-swap day/);
  refuse({ sessions: [] }, /at least one/);
  refuse({ sessions: [{ day_of_week: 1, quote_from: '24:00', quote_to: '24:00', trade_from: '00:00', trade_to: '24:00' }] }, /HH:MM/);
  refuse({ sessions: [weekdaySessions()[0], weekdaySessions()[0]] }, /one session per day/);
  refuse({ sessions: [{ ...weekdaySessions()[0], day_of_week: 7 }] }, /Invalid session day/);
});

test('min equal to max and long fractions compare exactly', () => {
  assert.doesNotThrow(() => buildBulkConfigureRequest({ symbols: ['AAA1'], form: { ...form(), min_volume: '1.10', max_volume: '1.1' } }));
  assert.throws(() => buildBulkConfigureRequest({ symbols: ['AAA1'], form: { ...form(), min_volume: '0.10000000000000000001', max_volume: '0.1' } }), /cannot exceed/);
});

test('override refusals name the symbol', () => {
  const refuse = (override, pattern) => assert.throws(() => buildBulkConfigureRequest({ symbols: ['AAA1'], form: form(), perSymbol: { AAA1: override } }), pattern);
  refuse({ digits: '1.5' }, /AAA1: digits/);
  refuse({ digits: '13' }, /AAA1: digits/);
  refuse({ margin_currency: 'US' }, /AAA1: margin currency/);
  refuse({ calc_mode: 'spot' }, /AAA1: select a supported/);
  refuse({ tick_size: '0' }, /AAA1: tick size/);
});

test('symbol count limits: none, and more than 200', () => {
  assert.throws(() => buildBulkConfigureRequest({ symbols: [], form: form() }), /at least one/);
  const many = Array.from({ length: MAX_BULK_SYMBOLS + 1 }, (_, i) => `S${i}`);
  assert.throws(() => buildBulkConfigureRequest({ symbols: many, form: form() }), /at most 200/);
  assert.equal(buildBulkConfigureRequest({ symbols: many.slice(0, MAX_BULK_SYMBOLS), form: form() }).symbols.length, MAX_BULK_SYMBOLS);
});

test('summary counts statuses and approvals and lists refused first', () => {
  const response = { results: [
    { symbol: 'CCC3', status: 'created', approval: { status: 'approved' } },
    { symbol: 'BBB2', status: 'refused', message: 'missing digits', approval: { status: 'not_requested' } },
    { symbol: 'AAA1', status: 'enabled', approval: { status: 'refused' } },
    { symbol: 'DDD4', status: 'exists_unchanged' },
    { symbol: 'EEE5', status: 'would_create' },
  ] };
  const summary = summarizeBulkResults(response);
  assert.equal(summary.total, 5);
  assert.deepEqual(summary.byStatus, { refused: 1, would_create: 1, created: 1, enabled: 1, exists_unchanged: 1 });
  assert.deepEqual(summary.byApproval, { approved: 1, refused: 1, not_requested: 1 });
  assert.deepEqual(summary.rows.map((row) => row.symbol), ['BBB2', 'EEE5', 'CCC3', 'AAA1', 'DDD4']);
  assert.deepEqual(summarizeBulkResults(null), { total: 0, byStatus: { refused: 0, would_create: 0, created: 0, enabled: 0, exists_unchanged: 0 }, byApproval: { approved: 0, refused: 0, not_requested: 0 }, rows: [] });
  assert.deepEqual(symbolsToCreate(response), ['EEE5']);
  assert.deepEqual(symbolsToCreate({}), []);
});

test('symbols go out in batches, and batch responses merge into one result', () => {
  const list = Array.from({ length: 60 }, (_, i) => `S${i}`);
  const batches = chunkSymbols(list);
  assert.equal(BULK_BATCH_SIZE, 25);
  assert.deepEqual(batches.map((b) => b.length), [25, 25, 10]);
  assert.deepEqual(batches.flat(), list);
  assert.deepEqual(chunkSymbols([]), []);
  const merged = mergeBulkResponses([
    { dry_run: false, results: [{ symbol: 'S0', status: 'created' }], summary: { requested: 1, created: 1, enabled: 1, refused: 0 } },
    { dry_run: false, results: [{ symbol: 'S1', status: 'refused' }], summary: { requested: 1, created: 0, enabled: 0, refused: 1 } },
  ]);
  assert.equal(merged.dry_run, false);
  assert.deepEqual(merged.results.map((r) => r.symbol), ['S0', 'S1']);
  assert.deepEqual(merged.summary, { requested: 2, created: 1, enabled: 1, refused: 1 });
});

test('symbols not reached (REQUEST_TIMEOUT) are offered for retry and the retry replaces their rows', () => {
  const first = { dry_run: false, results: [
    { symbol: 'AAA1', status: 'created' },
    { symbol: 'BBB2', status: 'refused', code: 'REQUEST_TIMEOUT' },
    { symbol: 'CCC3', status: 'refused', code: 'SPEC_MISSING' },
    { symbol: 'DDD4', status: 'refused', code: 'REQUEST_TIMEOUT' },
  ], summary: { requested: 4, created: 1, enabled: 0, refused: 3 } };
  assert.deepEqual(timedOutSymbols(first), ['BBB2', 'DDD4'], 'only REQUEST_TIMEOUT refusals are retried');
  const merged = replaceBulkResults(first, { results: [
    { symbol: 'BBB2', status: 'enabled' },
    { symbol: 'DDD4', status: 'refused', code: 'REQUEST_TIMEOUT' },
  ] });
  assert.deepEqual(merged.results.map((r) => `${r.symbol}:${r.status}`), ['AAA1:created', 'BBB2:enabled', 'CCC3:refused', 'DDD4:refused']);
  assert.deepEqual(merged.summary, { requested: 4, created: 1, enabled: 1, refused: 2 });
  assert.deepEqual(timedOutSymbols(merged), ['DDD4']);
  assert.deepEqual(timedOutSymbols(null), []);
});
