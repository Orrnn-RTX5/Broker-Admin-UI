import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('./lpExposureSummary.js', import.meta.url), 'utf8');
const { validateExposureSummary, createLPExposureSummary } = await import('data:text/javascript;base64,' + Buffer.from(source.replace("import { api } from '../lib/api.js';", 'const api = {};')).toString('base64'));
const group = () => ({connection_id:'demo',provider:'cserver',symbol:'BTCUSD',side:'buy',units_per_lot:'100000',intent_count:'1',reconciliation_count:'0',remaining_unknown_count:'0',known_wire_qty:'9007199254740993.000000000000000001',customer_assigned_wire_qty:'9007199254740993',awaiting_customer_wire_qty:'0',intentional_excess_wire_qty:'0.000000000000000001',exception_wire_qty:'0',unresolved_wire_qty:'0',recorded_remaining_wire_qty:'0'});
const summary = () => ({as_of:'2026-10-02T12:00:00Z',intent_count:'1',missing_attribution_count:'0',groups:[group()]});
test('aggregate exposure preserves exact quantities and closed remaining evidence', async () => {
  const result = await createLPExposureSummary(async () => summary()).get();
  assert.equal(result.groups[0].known_wire_qty, '9007199254740993.000000000000000001');
  assert.equal(result.groups[0].recorded_remaining_wire_qty, '0');
});
test('aggregate exposure refuses partial books and false remaining certainty', () => {
  const value = summary(); value.intent_count = '2';
  assert.throws(() => validateExposureSummary(value), /incomplete/);
  value.missing_attribution_count = '1'; assert.equal(validateExposureSummary(value), value);
  value.groups[0].remaining_unknown_count = '1';
  assert.throws(() => validateExposureSummary(value), /certainty/);
  value.groups[0].recorded_remaining_wire_qty = null; assert.equal(validateExposureSummary(value), value);
  value.groups[0].known_wire_qty = 9007199254740993; assert.throws(() => validateExposureSummary(value), /exact totals/);
});
test('aggregate exposure preserves separate sides and provider units', () => {
  const value = summary(); value.intent_count = '2'; value.groups.push({...group(),side:'sell',units_per_lot:'10'});
  assert.equal(validateExposureSummary(value).groups.length, 2);
  value.groups[1].units_per_lot = '0'; assert.throws(() => validateExposureSummary(value));
});
