import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FIX_RELAY_TOOL,
  capabilityEnvironmentRelayState,
  isFixRelayEnabled,
  normalizeFeatureFlag,
  resolveGatewayTools,
} from './fixRelayCapability.js';

test('normalises truthy switch values to true', () => {
  assert.equal(normalizeFeatureFlag(true), true);
  for (const value of ['true', 'TRUE', ' 1 ', 'yes', 'Y', 'on', 'ON']) {
    assert.equal(normalizeFeatureFlag(value), true, `expected ${JSON.stringify(value)} to be true`);
  }
});

test('normalises falsy switch values to false', () => {
  assert.equal(normalizeFeatureFlag(false), false);
  for (const value of ['false', 'FALSE', ' 0 ', 'no', 'N', 'off', 'OFF']) {
    assert.equal(normalizeFeatureFlag(value), false, `expected ${JSON.stringify(value)} to be false`);
  }
});

test('treats missing, blank and unrecognised values as unconfigured', () => {
  for (const value of [undefined, null, '', '   ', 'maybe', '2', 'enabled']) {
    assert.equal(normalizeFeatureFlag(value), undefined, `expected ${JSON.stringify(value)} to be undefined`);
  }
});

test('resolves an enabled registry entry to true', () => {
  assert.equal(
    capabilityEnvironmentRelayState([{ env: 'FIX_RELAY_ENABLED', state: 'enabled' }]),
    true,
  );
  assert.equal(
    capabilityEnvironmentRelayState([{ env: 'VITE_FIX_RELAY_ENABLED', state: 'Enabled' }]),
    true,
  );
  assert.equal(
    capabilityEnvironmentRelayState([{ env: 'OTHER_FLAG', key: 'fix_relay', state: 'enabled' }]),
    true,
  );
  assert.equal(
    capabilityEnvironmentRelayState([{ env: 'OTHER_FLAG', key: 'FIX-RELAY', state: ' enabled ' }]),
    true,
  );
});

test('resolves a disabled registry entry to false', () => {
  assert.equal(
    capabilityEnvironmentRelayState([{ env: 'FIX_RELAY_ENABLED', state: 'disabled' }]),
    false,
  );
  assert.equal(
    capabilityEnvironmentRelayState([{ env: 'OTHER_FLAG', key: 'fixrelay', state: 'Disabled' }]),
    false,
  );
});

test('treats invalid, unobserved and unknown states as unconfigured', () => {
  for (const state of ['invalid', 'unobserved', 'pending', '', 'unknown']) {
    assert.equal(
      capabilityEnvironmentRelayState([{ env: 'FIX_RELAY_ENABLED', state }]),
      undefined,
      `expected state ${JSON.stringify(state)} to be undefined`,
    );
  }
  assert.equal(capabilityEnvironmentRelayState([{ env: 'FIX_RELAY_ENABLED' }]), undefined);
});

test('ignores registries without a relay entry', () => {
  assert.equal(capabilityEnvironmentRelayState(undefined), undefined);
  assert.equal(capabilityEnvironmentRelayState(null), undefined);
  assert.equal(capabilityEnvironmentRelayState({}), undefined);
  assert.equal(capabilityEnvironmentRelayState([]), undefined);
  assert.equal(
    capabilityEnvironmentRelayState([{ env: 'OTHER_FLAG', key: 'other', state: 'enabled' }]),
    undefined,
  );
  assert.equal(
    capabilityEnvironmentRelayState([null, { env: 'OTHER_FLAG', state: 'enabled' }]),
    undefined,
  );
});

test('runtime enabled wins over capability and build sources', () => {
  assert.equal(
    isFixRelayEnabled({
      runtimeConfig: { FIX_RELAY_ENABLED: 'true' },
      capabilityEnvironment: [{ env: 'FIX_RELAY_ENABLED', state: 'disabled' }],
      buildEnv: { VITE_FIX_RELAY_ENABLED: 'false' },
    }),
    true,
  );
  assert.equal(
    isFixRelayEnabled({
      runtimeConfig: { FIX_RELAY_ENABLED: true },
      capabilityEnvironment: [{ env: 'FIX_RELAY_ENABLED', state: 'disabled' }],
      buildEnv: {},
    }),
    true,
  );
  assert.equal(
    isFixRelayEnabled({
      runtimeConfig: { VITE_FIX_RELAY_ENABLED: 'yes' },
      capabilityEnvironment: [{ env: 'FIX_RELAY_ENABLED', state: 'disabled' }],
      buildEnv: {},
    }),
    true,
  );
  assert.equal(
    isFixRelayEnabled({
      runtimeConfig: { FIX_RELAY_ENABLED: 'true', VITE_FIX_RELAY_ENABLED: 'false' },
      capabilityEnvironment: [],
      buildEnv: {},
    }),
    true,
  );
});

test('runtime disabled wins over capability and build sources', () => {
  assert.equal(
    isFixRelayEnabled({
      runtimeConfig: { FIX_RELAY_ENABLED: 'false' },
      capabilityEnvironment: [{ env: 'FIX_RELAY_ENABLED', state: 'enabled' }],
      buildEnv: { VITE_FIX_RELAY_ENABLED: 'true' },
    }),
    false,
  );
  assert.equal(
    isFixRelayEnabled({
      runtimeConfig: { FIX_RELAY_ENABLED: false },
      capabilityEnvironment: [{ env: 'FIX_RELAY_ENABLED', state: 'enabled' }],
      buildEnv: { VITE_FIX_RELAY_ENABLED: 'true' },
    }),
    false,
  );
  for (const value of ['0', 'no', 'off']) {
    assert.equal(
      isFixRelayEnabled({
        runtimeConfig: { FIX_RELAY_ENABLED: value },
        capabilityEnvironment: [{ env: 'FIX_RELAY_ENABLED', state: 'enabled' }],
        buildEnv: { VITE_FIX_RELAY_ENABLED: 'true' },
      }),
      false,
      `expected runtime ${JSON.stringify(value)} to disable the panel`,
    );
  }
});

test('falls through to the capability environment when runtime is unset', () => {
  assert.equal(
    isFixRelayEnabled({
      runtimeConfig: {},
      capabilityEnvironment: [{ env: 'FIX_RELAY_ENABLED', state: 'enabled' }],
      buildEnv: { VITE_FIX_RELAY_ENABLED: 'false' },
    }),
    true,
  );
  assert.equal(
    isFixRelayEnabled({
      runtimeConfig: {},
      capabilityEnvironment: [{ env: 'FIX_RELAY_ENABLED', state: 'disabled' }],
      buildEnv: { VITE_FIX_RELAY_ENABLED: 'true' },
    }),
    false,
  );
});

test('falls through blank or unrecognised runtime values to the next source', () => {
  assert.equal(
    isFixRelayEnabled({
      runtimeConfig: { FIX_RELAY_ENABLED: '' },
      capabilityEnvironment: [{ env: 'FIX_RELAY_ENABLED', state: 'enabled' }],
      buildEnv: {},
    }),
    true,
  );
  assert.equal(
    isFixRelayEnabled({
      runtimeConfig: { FIX_RELAY_ENABLED: 'maybe' },
      capabilityEnvironment: [{ env: 'FIX_RELAY_ENABLED', state: 'disabled' }],
      buildEnv: { VITE_FIX_RELAY_ENABLED: 'true' },
    }),
    false,
  );
  assert.equal(
    isFixRelayEnabled({
      runtimeConfig: { FIX_RELAY_ENABLED: '   ' },
      capabilityEnvironment: [{ env: 'FIX_RELAY_ENABLED', state: 'invalid' }],
      buildEnv: { VITE_FIX_RELAY_ENABLED: 'true' },
    }),
    true,
  );
});

test('falls back to the build flag when runtime and capability are unconfigured', () => {
  assert.equal(
    isFixRelayEnabled({
      runtimeConfig: {},
      capabilityEnvironment: [],
      buildEnv: { VITE_FIX_RELAY_ENABLED: 'true' },
    }),
    true,
  );
  assert.equal(
    isFixRelayEnabled({
      runtimeConfig: {},
      capabilityEnvironment: [],
      buildEnv: { VITE_FIX_RELAY_ENABLED: 'false' },
    }),
    false,
  );
  assert.equal(
    isFixRelayEnabled({
      runtimeConfig: {},
      capabilityEnvironment: [{ env: 'FIX_RELAY_ENABLED', state: 'invalid' }],
      buildEnv: { VITE_FIX_RELAY_ENABLED: 'true' },
    }),
    true,
  );
  assert.equal(
    isFixRelayEnabled({
      runtimeConfig: {},
      capabilityEnvironment: [{ env: 'FIX_RELAY_ENABLED', state: 'unobserved' }],
      buildEnv: { VITE_FIX_RELAY_ENABLED: 'off' },
    }),
    false,
  );
});

test('stays closed by default when every source is unconfigured', () => {
  assert.equal(isFixRelayEnabled({}), false);
  assert.equal(isFixRelayEnabled({ runtimeConfig: {}, capabilityEnvironment: [], buildEnv: {} }), false);
  assert.equal(
    isFixRelayEnabled({
      runtimeConfig: { FIX_RELAY_ENABLED: 'maybe' },
      capabilityEnvironment: [{ env: 'FIX_RELAY_ENABLED', state: 'invalid' }],
      buildEnv: { VITE_FIX_RELAY_ENABLED: 'someday' },
    }),
    false,
  );
  assert.equal(isFixRelayEnabled(), false);
});

test('exposes a frozen relay tool descriptor', () => {
  assert.equal(FIX_RELAY_TOOL.id, 'relay');
  assert.equal(FIX_RELAY_TOOL.section, 'readiness');
  assert.equal(Object.isFrozen(FIX_RELAY_TOOL), true);
});

test('strips the relay tool when the capability is disabled', () => {
  const base = [
    { section: 'readiness', id: 'status' },
    { ...FIX_RELAY_TOOL },
    { section: 'legacy', id: 'feed' },
  ];
  const resolved = resolveGatewayTools(base, false);
  assert.deepEqual(
    resolved.map((tool) => tool.id),
    ['status', 'feed'],
  );
  assert.deepEqual(resolveGatewayTools([{ section: 'readiness', id: 'status' }], false), [
    { section: 'readiness', id: 'status' },
  ]);
  assert.deepEqual(resolveGatewayTools([], false), []);
});

test('inserts the relay tool ahead of the legacy section when enabled', () => {
  const base = [
    { section: 'readiness', id: 'status' },
    { section: 'legacy', id: 'feed' },
    { section: 'legacy', id: 'logs' },
  ];
  const resolved = resolveGatewayTools(base, true);
  assert.deepEqual(
    resolved.map((tool) => tool.id),
    ['status', 'relay', 'feed', 'logs'],
  );
  assert.equal(resolved[1], FIX_RELAY_TOOL);
  assert.deepEqual(
    base.map((tool) => tool.id),
    ['status', 'feed', 'logs'],
  );
});

test('appends the relay tool when no legacy section exists', () => {
  const base = [{ section: 'readiness', id: 'status' }];
  const resolved = resolveGatewayTools(base, true);
  assert.deepEqual(resolved, [...base, FIX_RELAY_TOOL]);
  assert.equal(resolved[resolved.length - 1], FIX_RELAY_TOOL);
});

test('never duplicates the relay tool', () => {
  const base = [
    { section: 'readiness', id: 'status' },
    { ...FIX_RELAY_TOOL },
    { section: 'legacy', id: 'feed' },
  ];
  const resolved = resolveGatewayTools(base, true);
  assert.equal(resolved, base);
  assert.equal(resolved.filter((tool) => tool?.id === FIX_RELAY_TOOL.id).length, 1);
});

test('tolerates a missing base tool list', () => {
  assert.deepEqual(resolveGatewayTools(undefined, false), []);
  assert.deepEqual(resolveGatewayTools(null, false), []);
  assert.deepEqual(resolveGatewayTools(undefined, true), [FIX_RELAY_TOOL]);
  assert.deepEqual(resolveGatewayTools(null, true), [FIX_RELAY_TOOL]);
});
