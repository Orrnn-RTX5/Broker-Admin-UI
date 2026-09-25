// Tests for the Server Config > Demo Accounts tab helpers.
// Run with: node --test src/utils/demoAccountGroup.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import {
  AUTOMATIC_DEMO_GROUP_LABEL,
  normalizeDemoAccountGroupState,
  formatDemoGroupOptionLabel,
  buildDemoGroupStatus,
  buildDemoGroupOptions,
  initialDemoGroupSelection,
  isDemoGroupSelectionChanged,
} from './demoAccountGroup.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const response = (overrides = {}) => ({
  broker_id: 'trivanta-markets',
  group: 'demo\\standard',
  configured: true,
  valid: true,
  effective_group: 'demo\\standard',
  demo_groups: [
    { name: 'demo\\standard', description: '', currency: 'USD', leverage: 100 },
    { name: 'demo\\pro', description: 'Pro', currency: 'EUR', leverage: 500 },
  ],
  ...overrides,
});

test('normalizeDemoAccountGroupState maps the backend contract', () => {
  const s = normalizeDemoAccountGroupState(response());
  assert.equal(s.brokerId, 'trivanta-markets');
  assert.equal(s.group, 'demo\\standard');
  assert.equal(s.configured, true);
  assert.equal(s.valid, true);
  assert.equal(s.effectiveGroup, 'demo\\standard');
  assert.deepEqual(s.demoGroups.map((g) => g.name), ['demo\\standard', 'demo\\pro']);
  assert.equal(s.demoGroups[0].leverage, 100);
});

test('normalizeDemoAccountGroupState tolerates empty / malformed input', () => {
  for (const raw of [null, undefined, {}, 'oops']) {
    const s = normalizeDemoAccountGroupState(raw);
    assert.equal(s.group, '');
    assert.equal(s.configured, false);
    assert.equal(s.valid, false);
    assert.equal(s.effectiveGroup, '');
    assert.deepEqual(s.demoGroups, []);
  }
  const s = normalizeDemoAccountGroupState({ demo_groups: [null, { name: '' }, { name: 'demo\\x', leverage: 'abc' }] });
  assert.deepEqual(s.demoGroups, [{ name: 'demo\\x', description: '', currency: '', leverage: null }]);
});

test('formatDemoGroupOptionLabel shows currency and leverage', () => {
  assert.equal(formatDemoGroupOptionLabel({ name: 'demo\\standard', currency: 'USD', leverage: 100 }), 'demo\\standard (USD, 1:100)');
  assert.equal(formatDemoGroupOptionLabel({ name: 'demo\\a', currency: 'USD' }), 'demo\\a (USD)');
  assert.equal(formatDemoGroupOptionLabel({ name: 'demo\\b', leverage: 0 }), 'demo\\b');
  assert.equal(formatDemoGroupOptionLabel({ name: 'demo\\c', leverage: '200' }), 'demo\\c (1:200)');
});

test('buildDemoGroupStatus: configured & valid', () => {
  const status = buildDemoGroupStatus(normalizeDemoAccountGroupState(response()));
  assert.deepEqual(status, { tone: 'ok', message: 'Current demo group: demo\\standard' });
});

test('buildDemoGroupStatus: configured & invalid warns that signup is blocked', () => {
  const status = buildDemoGroupStatus(normalizeDemoAccountGroupState(response({
    group: 'demo\\gone', valid: false, effective_group: '',
  })));
  assert.equal(status.tone, 'error');
  assert.match(status.message, /The configured group demo\\gone is missing, disabled or no longer a demo group/);
  assert.match(status.message, /demo signup from the terminal is blocked until you pick a valid group\./);
});

test('buildDemoGroupStatus: not configured uses automatic default', () => {
  const status = buildDemoGroupStatus(normalizeDemoAccountGroupState(response({
    group: '', configured: false, valid: false, effective_group: 'demo\\pro',
  })));
  assert.deepEqual(status, { tone: 'info', message: 'Not set — using the automatic default: demo\\pro' });
});

test('buildDemoGroupStatus: no demo groups at all', () => {
  const status = buildDemoGroupStatus(normalizeDemoAccountGroupState(response({
    group: '', configured: false, valid: false, effective_group: '', demo_groups: [],
  })));
  assert.equal(status.tone, 'error');
  assert.equal(status.message, "No enabled demo group exists — demo signup is unavailable. Create a group with 'Demo Account' checked first.");
});

test('buildDemoGroupOptions: automatic first, then demo groups', () => {
  const options = buildDemoGroupOptions(normalizeDemoAccountGroupState(response()));
  assert.deepEqual(options, [
    { value: '', label: AUTOMATIC_DEMO_GROUP_LABEL, disabled: false },
    { value: 'demo\\standard', label: 'demo\\standard (USD, 1:100)', disabled: false },
    { value: 'demo\\pro', label: 'demo\\pro (EUR, 1:500)', disabled: false },
  ]);
  assert.equal(AUTOMATIC_DEMO_GROUP_LABEL, 'Automatic (alphabetically first demo group)');
});

test('buildDemoGroupOptions keeps an invalid configured group as a disabled option', () => {
  const options = buildDemoGroupOptions(normalizeDemoAccountGroupState(response({ group: 'demo\\gone', valid: false })));
  assert.deepEqual(options.at(-1), { value: 'demo\\gone', label: 'demo\\gone (unavailable)', disabled: true });
  assert.equal(options.length, 4);
});

test('selection helpers: preselect configured group and detect changes', () => {
  const configured = normalizeDemoAccountGroupState(response());
  assert.equal(initialDemoGroupSelection(configured), 'demo\\standard');
  assert.equal(isDemoGroupSelectionChanged(configured, 'demo\\standard'), false);
  assert.equal(isDemoGroupSelectionChanged(configured, 'demo\\pro'), true);
  assert.equal(isDemoGroupSelectionChanged(configured, ''), true);

  const automatic = normalizeDemoAccountGroupState(response({ group: '', configured: false, valid: false }));
  assert.equal(initialDemoGroupSelection(automatic), '');
  assert.equal(isDemoGroupSelectionChanged(automatic, ''), false);
  assert.equal(isDemoGroupSelectionChanged(automatic, 'demo\\pro'), true);
});

test('service and view are wired to the DemoAccountGroup endpoints', () => {
  const service = readFileSync(resolve(__dirname, '../services/serverConfig.service.js'), 'utf8');
  const view = readFileSync(resolve(__dirname, '../components/organisms/ServerConfigView.jsx'), 'utf8');
  assert.match(service, /\/DemoAccountGroupGet`,\s*\{\s*timeout:\s*SERVER_CONFIG_READ_TIMEOUT_MS/);
  assert.match(service, /api\.post\(`\$\{MANAGER\}\/DemoAccountGroupSet`,\s*\{\s*group:/);
  assert.match(service, /const MANAGER = '\/manager'/);
  assert.match(view, /'Demo Accounts'/);
  assert.match(view, /Demo accounts created from the web terminal are opened in this group\./);
  assert.match(view, /Demo account group failed to load\./);
});
