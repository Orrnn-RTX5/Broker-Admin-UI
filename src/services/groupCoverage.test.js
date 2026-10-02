/* global Buffer */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('./groupCoverage.js', import.meta.url), 'utf8');
const { createGroupCoverage, coverageAssignmentPayload } = await import('data:text/javascript;base64,' + Buffer.from('const defaultRequest=()=>{};\n' + source.slice(source.indexOf('const base ='))).toString('base64'));
const account = '11111111-1111-1111-1111-111111111111';
test('coverage destinations are independent of accounting mode and percentage', () => {
  assert.deepEqual(coverageAssignmentPayload('9007199254740993', 'external', 'lp-one'), { expected_revision: '9007199254740993', destination_kind: 'external', connection_id: 'lp-one' });
  assert.deepEqual(coverageAssignmentPayload('0', 'internal', ''), { expected_revision: '0', destination_kind: 'internal', connection_id: '' });
  assert.throws(() => coverageAssignmentPayload('0', 'internal', 'lp-one'));
  assert.throws(() => coverageAssignmentPayload(1, 'external', 'lp-one'));
});
test('coverage writes pin the exact client group/account and surface exclusive assignment conflicts', async () => {
  const calls = []; let ok = true;
  const api = createGroupCoverage(async (endpoint, options) => { calls.push({ endpoint, options }); return { ok, json: async () => ok ? {} : { error_code: 'LP_COVERAGE_ASSIGNMENT_CONFLICT' } }; });
  await api.save('real\\client', account, '3', 'external', 'lp-one');
  assert.equal(calls[0].options.method, 'PUT'); assert.equal(calls[0].endpoint, `/api/v1/manager/lp-routing/group-coverage/real%5Cclient/${account}`);
  assert.equal(JSON.parse(calls[0].options.body).expected_revision, '3');
  ok = false; await assert.rejects(api.get('real\\client', account), /assigned to another client group/);
});
