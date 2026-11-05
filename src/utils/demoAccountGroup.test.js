// Tests for the Server Config > Demo Accounts tab helpers.
// Run with: node --test src/utils/demoAccountGroup.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import {
  AUTOMATIC_DEMO_GROUP_LABEL,
  DEMO_SIGNUP_DISABLED_MESSAGE,
  DEMO_SERVER_DISABLED_WARNING,
  DEMO_DISABLE_CONFIRM_MESSAGE,
  buildDemoAccountGroupSetBody,
  buildDemoServerWarning,
  normalizeDemoAccountGroupState,
  formatDemoGroupOptionLabel,
  buildDemoGroupStatus,
  buildDemoGroupOptions,
  initialDemoGroupSelection,
  isDemoGroupSelectionChanged,
  NETTING_DEMO_CONTRACT,
  NETTING_DEMO_OFF_LABEL,
  buildNettingDemoGroupOptions,
  buildNettingDemoGroupStatus,
  initialNettingDemoGroupSelection,
  isNettingDemoGroupSelectionChanged,
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

test('normalizeDemoAccountGroupState maps the signup switches', () => {
  const s = normalizeDemoAccountGroupState(response({ signup_enabled: false, server_enabled: true, signup_available: false }));
  assert.equal(s.signupEnabled, false);
  assert.equal(s.serverEnabled, true);
  assert.equal(s.signupAvailable, false);

  const off = normalizeDemoAccountGroupState(response({ signup_enabled: true, server_enabled: false, signup_available: false }));
  assert.equal(off.signupEnabled, true);
  assert.equal(off.serverEnabled, false);
  assert.equal(off.signupAvailable, false);
});

test('normalizeDemoAccountGroupState defaults both switches to on when missing', () => {
  const s = normalizeDemoAccountGroupState(response());
  assert.equal(s.signupEnabled, true);
  assert.equal(s.serverEnabled, true);
  // signup_available missing: derived from switches + effective group.
  assert.equal(s.signupAvailable, true);
  assert.equal(normalizeDemoAccountGroupState(response({ effective_group: '' })).signupAvailable, false);
  assert.equal(normalizeDemoAccountGroupState(response({ signup_enabled: false })).signupAvailable, false);
  assert.equal(normalizeDemoAccountGroupState(response({ server_enabled: false })).signupAvailable, false);
  for (const raw of [null, {}, { signup_enabled: null, server_enabled: 'yes' }]) {
    const e = normalizeDemoAccountGroupState(raw);
    assert.equal(e.signupEnabled, true);
    assert.equal(e.serverEnabled, true);
  }
  // Backend value wins when present.
  assert.equal(normalizeDemoAccountGroupState(response({ signup_available: false })).signupAvailable, false);
});

test('buildDemoGroupStatus: admin switch off takes precedence over the group state', () => {
  const expected = { tone: 'warning', message: 'Demo signup is disabled — guests cannot create demo accounts.' };
  assert.deepEqual(buildDemoGroupStatus(normalizeDemoAccountGroupState(response({ signup_enabled: false }))), expected);
  assert.deepEqual(buildDemoGroupStatus(normalizeDemoAccountGroupState(response({
    signup_enabled: false, server_enabled: false, group: 'demo\\gone', valid: false,
  }))), expected);
  assert.equal(DEMO_SIGNUP_DISABLED_MESSAGE, expected.message);
});

test('buildDemoGroupStatus: server switch off', () => {
  const status = buildDemoGroupStatus(normalizeDemoAccountGroupState(response({ server_enabled: false })));
  assert.deepEqual(status, {
    tone: 'warning',
    message: 'Demo signup is switched off on the server — guests cannot create demo accounts.',
  });
});

test('buildDemoServerWarning only when the server switch is off', () => {
  assert.equal(buildDemoServerWarning(normalizeDemoAccountGroupState(response())), null);
  assert.equal(buildDemoServerWarning(normalizeDemoAccountGroupState(response({ signup_enabled: false }))), null);
  assert.equal(buildDemoServerWarning(null), null);
  assert.equal(
    buildDemoServerWarning(normalizeDemoAccountGroupState(response({ server_enabled: false }))),
    'Demo signup is switched off on the server (PUBLIC_DEMO_ENABLED=false in the backend .env). ' +
      'Set it to true and restart the gateway and manager to allow demo accounts.',
  );
  assert.equal(DEMO_SERVER_DISABLED_WARNING, buildDemoServerWarning({ serverEnabled: false }));
});

test('buildDemoAccountGroupSetBody sends only the provided keys', () => {
  assert.deepEqual(buildDemoAccountGroupSetBody({ group: 'demo\\pro' }), { group: 'demo\\pro' });
  assert.deepEqual(buildDemoAccountGroupSetBody({ group: '' }), { group: '' });
  assert.deepEqual(buildDemoAccountGroupSetBody({ group: null }), { group: '' });
  assert.deepEqual(buildDemoAccountGroupSetBody({ signupEnabled: false }), { signup_enabled: false });
  assert.deepEqual(buildDemoAccountGroupSetBody({ signupEnabled: true }), { signup_enabled: true });
  assert.deepEqual(buildDemoAccountGroupSetBody({ group: 'demo\\a', signupEnabled: true }), { group: 'demo\\a', signup_enabled: true });
  assert.deepEqual(buildDemoAccountGroupSetBody({ group: undefined, signupEnabled: false }), { signup_enabled: false });
  for (const bad of [undefined, null, {}, { group: undefined }, { signupEnabled: 'yes' }]) {
    assert.throws(() => buildDemoAccountGroupSetBody(bad), /requires a group and\/or signupEnabled/);
  }
});

test('service and view are wired to the DemoAccountGroup endpoints', () => {
  const service = readFileSync(resolve(__dirname, '../services/serverConfig.service.js'), 'utf8');
  const workspace = readFileSync(resolve(__dirname, '../components/organisms/ServerConfigWorkspace.jsx'), 'utf8');
  const view = readFileSync(resolve(__dirname, '../components/organisms/ServerConfigDemoAccounts.jsx'), 'utf8');
  assert.match(workspace, /\{ id: 'demo', label: 'Demo Accounts'/);
  assert.match(workspace, /\{tab === 'demo' && <DemoAccountsTab \/>\}/);
  assert.match(service, /\/DemoAccountGroupGet`,\s*\{\s*timeout:\s*SERVER_CONFIG_READ_TIMEOUT_MS/);
  assert.match(service, /setDemoAccountGroup:\s*\(changes\)\s*=>\s*api\.post\(`\$\{MANAGER\}\/DemoAccountGroupSet`,\s*buildDemoAccountGroupSetBody\(changes\)\)/);
  assert.match(service, /import \{ buildDemoAccountGroupSetBody \} from '\.\.\/utils\/demoAccountGroup(?:\.js)?'/);
  assert.match(service, /const MANAGER = '\/manager'/);
  assert.match(view, /Demo accounts created from the web terminal are opened in this group\./);
  assert.match(view, /Demo account group failed to load\./);
  // Group Save sends only the group; the switch sends only signupEnabled.
  assert.match(view, /setDemoAccountGroup\(\{ group: selected \}\)/);
  assert.match(view, /setDemoAccountGroup\(\{ signupEnabled: next \}\)/);
  assert.match(view, /if \(!next && !window\.confirm\(DEMO_DISABLE_CONFIRM_MESSAGE\)\) return;/);
  assert.match(view, /Allow demo account creation from the web terminal/);
  assert.match(view, /role="switch"/);
  assert.match(view, /To stop demo accounts entirely, use the switch above\./);
  assert.equal(
    DEMO_DISABLE_CONFIRM_MESSAGE,
    'Disable demo signup? Guests in the web terminal will no longer be able to create demo accounts.',
  );
});

// ─── Netting demo group (setting public_demo_netting_group) ──────────────────
const C = NETTING_DEMO_CONTRACT;
const nettingResponse = (overrides = {}) => response({
  [C.responseGroupKey]: '',
  demo_groups: [
    { name: 'demo\\hedge', currency: 'USD', leverage: 100, margin_mode: 'hedging' },
    { name: 'demo\\net', currency: 'USD', leverage: 100, margin_mode: 'netting' },
    { name: 'demo\\unknown', currency: 'USD', leverage: 100 },
    { name: 'demo\\net-pro', currency: 'EUR', leverage: 500, marginMode: ' NETTING ' },
  ],
  ...overrides,
});

test('netting: only netting demo groups are listed (no margin mode is never listed)', () => {
  const s = normalizeDemoAccountGroupState(nettingResponse());
  assert.deepEqual(s.nettingDemoGroups.map((g) => g.name), ['demo\\net', 'demo\\net-pro']);
  // The regular demo group list is unchanged.
  assert.deepEqual(s.demoGroups.map((g) => g.name), ['demo\\hedge', 'demo\\net', 'demo\\unknown', 'demo\\net-pro']);
});

test('netting: a server netting-only list wins over filtering demo_groups', () => {
  const s = normalizeDemoAccountGroupState(nettingResponse({
    [C.responseListKey]: [{ name: 'demo\\server-net', currency: 'USD', leverage: 50 }, null, { name: ' ' }],
  }));
  assert.deepEqual(s.nettingDemoGroups, [{ name: 'demo\\server-net', description: '', currency: 'USD', leverage: 50 }]);
  assert.deepEqual(normalizeDemoAccountGroupState(nettingResponse({ [C.responseListKey]: [] })).nettingDemoGroups, []);
  // A server entry that names another margin mode is still dropped.
  const mixed = normalizeDemoAccountGroupState(nettingResponse({
    [C.responseListKey]: [
      { name: 'demo\\srv-net', margin_mode: 'netting' },
      { name: 'demo\\srv-hedge', margin_mode: 'hedging' },
      { name: 'demo\\srv-plain' },
    ],
  }));
  assert.deepEqual(mixed.nettingDemoGroups.map((g) => g.name), ['demo\\srv-net', 'demo\\srv-plain']);
  // A list key that is not an array falls back to filtering demo_groups.
  assert.deepEqual(normalizeDemoAccountGroupState(nettingResponse({ [C.responseListKey]: 'oops' })).nettingDemoGroups.map((g) => g.name),
    ['demo\\net', 'demo\\net-pro']);
});

test('netting: a stored group the server reports valid stays selectable even if not listed', () => {
  const s = normalizeDemoAccountGroupState(nettingResponse({ [C.responseGroupKey]: 'demo\\elsewhere', [C.responseValidKey]: true }));
  assert.deepEqual(buildNettingDemoGroupOptions(s).at(-1), { value: 'demo\\elsewhere', label: 'demo\\elsewhere', disabled: false });
});

test('netting: Off is the first option, then netting groups only', () => {
  const options = buildNettingDemoGroupOptions(normalizeDemoAccountGroupState(nettingResponse()));
  assert.deepEqual(options, [
    { value: '', label: NETTING_DEMO_OFF_LABEL, disabled: false },
    { value: 'demo\\net', label: 'demo\\net (USD, 1:100)', disabled: false },
    { value: 'demo\\net-pro', label: 'demo\\net-pro (EUR, 1:500)', disabled: false },
  ]);
  assert.equal(NETTING_DEMO_OFF_LABEL, 'Off (no netting demo accounts)');
  // No netting group at all: only the Off option.
  assert.deepEqual(buildNettingDemoGroupOptions(normalizeDemoAccountGroupState(response({ [C.responseGroupKey]: '' }))),
    [{ value: '', label: NETTING_DEMO_OFF_LABEL, disabled: false }]);
});

test('netting: a stored group that is not a netting demo group stays as a disabled option', () => {
  const s = normalizeDemoAccountGroupState(nettingResponse({ [C.responseGroupKey]: 'demo\\hedge', [C.responseValidKey]: false }));
  const options = buildNettingDemoGroupOptions(s);
  assert.deepEqual(options.at(-1), { value: 'demo\\hedge', label: 'demo\\hedge (unavailable)', disabled: true });
  assert.equal(options.filter((o) => o.value === 'demo\\hedge').length, 1);
});

test('netting: state mapping, supported flag and validity', () => {
  const valid = normalizeDemoAccountGroupState(nettingResponse({ [C.responseGroupKey]: ' demo\\net ', [C.responseValidKey]: true }));
  assert.equal(valid.nettingSupported, true);
  assert.equal(valid.nettingGroup, 'demo\\net');
  assert.equal(valid.nettingValid, true);
  // Validity needs an explicit true and a stored group.
  assert.equal(normalizeDemoAccountGroupState(nettingResponse({ [C.responseGroupKey]: 'demo\\net', [C.responseValidKey]: 'yes' })).nettingValid, false);
  assert.equal(normalizeDemoAccountGroupState(nettingResponse({ [C.responseValidKey]: true })).nettingValid, false);
  // A null stored value from the backend still means "supported, off".
  const off = normalizeDemoAccountGroupState(response({ [C.responseGroupKey]: null }));
  assert.equal(off.nettingSupported, true);
  assert.equal(off.nettingGroup, '');
  // An older backend without the setting: not supported, nothing listed.
  for (const raw of [response(), null, {}, 'oops']) {
    const old = normalizeDemoAccountGroupState(raw);
    assert.equal(old.nettingSupported, false);
    assert.equal(old.nettingGroup, '');
    assert.deepEqual(old.nettingDemoGroups, []);
  }
});

test('netting: status texts for off, valid, invalid and none available', () => {
  assert.deepEqual(buildNettingDemoGroupStatus(normalizeDemoAccountGroupState(nettingResponse())),
    { tone: 'info', message: 'Netting demo accounts are off.' });
  assert.deepEqual(buildNettingDemoGroupStatus(normalizeDemoAccountGroupState(response({ [C.responseGroupKey]: '' }))),
    { tone: 'info', message: "Netting demo accounts are off. No netting demo group can be selected — a demo group with margin mode 'Netting' is needed to offer them." });
  assert.deepEqual(buildNettingDemoGroupStatus(normalizeDemoAccountGroupState(nettingResponse({ [C.responseGroupKey]: 'demo\\net', [C.responseValidKey]: true }))),
    { tone: 'ok', message: 'Netting demo group: demo\\net' });
  const invalid = buildNettingDemoGroupStatus(normalizeDemoAccountGroupState(nettingResponse({ [C.responseGroupKey]: 'demo\\gone', [C.responseValidKey]: false })));
  assert.equal(invalid.tone, 'error');
  assert.match(invalid.message, /The netting demo group demo\\gone is missing, disabled or no longer a netting demo group/);
  assert.match(invalid.message, /blocked until you pick a valid group or switch it off\./);
});

test('netting: selection helpers', () => {
  const stored = normalizeDemoAccountGroupState(nettingResponse({ [C.responseGroupKey]: 'demo\\net', [C.responseValidKey]: true }));
  assert.equal(initialNettingDemoGroupSelection(stored), 'demo\\net');
  assert.equal(isNettingDemoGroupSelectionChanged(stored, 'demo\\net'), false);
  assert.equal(isNettingDemoGroupSelectionChanged(stored, ''), true);
  const off = normalizeDemoAccountGroupState(nettingResponse());
  assert.equal(initialNettingDemoGroupSelection(off), '');
  assert.equal(isNettingDemoGroupSelectionChanged(off, ''), false);
  assert.equal(isNettingDemoGroupSelectionChanged(off, 'demo\\net-pro'), true);
  assert.equal(initialNettingDemoGroupSelection(null), '');
});

test('netting: Set body sends only the netting key; empty switches it off', () => {
  assert.deepEqual(buildDemoAccountGroupSetBody({ nettingGroup: 'demo\\net' }), { [C.requestKey]: 'demo\\net' });
  assert.deepEqual(buildDemoAccountGroupSetBody({ nettingGroup: '' }), { [C.requestKey]: '' });
  assert.deepEqual(buildDemoAccountGroupSetBody({ nettingGroup: null }), { [C.requestKey]: '' });
  assert.deepEqual(buildDemoAccountGroupSetBody({ nettingGroup: ' demo\\net ' }), { [C.requestKey]: 'demo\\net' });
  // Existing callers are unchanged: no netting key unless asked.
  assert.deepEqual(buildDemoAccountGroupSetBody({ group: 'demo\\pro' }), { group: 'demo\\pro' });
  assert.equal(Object.hasOwn(buildDemoAccountGroupSetBody({ signupEnabled: true }), C.requestKey), false);
});

test('netting: view shows the netting block only when supported and saves only the netting key', () => {
  const view = readFileSync(resolve(__dirname, '../components/organisms/ServerConfigDemoAccounts.jsx'), 'utf8');
  assert.match(view, /\{state\.nettingSupported && \(/);
  assert.match(view, /id="netting-demo-group-select"/);
  assert.match(view, /buildNettingDemoGroupOptions\(state\)/);
  assert.match(view, /setDemoAccountGroup\(\{ nettingGroup: nettingSelected \}\)/);
  assert.match(view, /setNettingSelected\(initialNettingDemoGroupSelection\(next\)\)/);
  assert.match(view, /disabled=\{busy \|\| !nettingChanged\}/);
  // The existing group Save still sends only the group.
  assert.match(view, /setDemoAccountGroup\(\{ group: selected \}\)/);
});

test('netting: backend r2 contract payload (DemoAccountGroupGet) maps to a selectable netting group', () => {
  // Shape from DESIGN-DEMO-NETTING.md section 6 r2: netting_demo_groups items carry no margin_mode,
  // and demo_groups now lists hedging groups only.
  const s = normalizeDemoAccountGroupState({
    broker_id: 'b1', group: '', configured: false, valid: false, effective_group: 'demo\\hedge',
    demo_groups: [{ name: 'demo\\hedge', description: '', currency: 'USD', leverage: 100 }],
    signup_enabled: true, server_enabled: true, signup_available: true,
    netting_group: 'demo\\net-a', netting_configured: true, netting_valid: true,
    netting_demo_groups: [{ name: 'demo\\net-a', description: '', currency: 'USD', leverage: 100 }],
    netting_signup_available: true,
  });
  assert.equal(s.nettingSupported, true);
  assert.equal(s.nettingValid, true);
  assert.deepEqual(buildNettingDemoGroupOptions(s).map((o) => [o.value, o.disabled]), [['', false], ['demo\\net-a', false]]);
  assert.equal(buildNettingDemoGroupStatus(s).tone, 'ok');
  // Unset is "" on this backend: still supported, Off selected.
  const off = normalizeDemoAccountGroupState({ netting_group: '', netting_valid: false, netting_demo_groups: null, demo_groups: [] });
  assert.equal(off.nettingSupported, true);
  assert.equal(initialNettingDemoGroupSelection(off), '');
  assert.deepEqual(buildNettingDemoGroupOptions(off).map((o) => o.value), ['']);
});
