// Runtime capability for the Superadmin FIX relay panel (SUI-A9).
//
// The relay panel used to be gated by the build-time flag
// VITE_FIX_RELAY_ENABLED, so one build could not serve brokers with different
// relay access. It is now a per-deployment runtime capability read from the
// existing feature-switch mechanism:
//
//   1. window.__RTX5_RUNTIME_CONFIG__.FIX_RELAY_ENABLED (emitted per
//      deployment by docker-entrypoint.sh; readable via getRuntimeValue),
//   2. a deployment-gated entry reported in the broker capability registry
//      environment list (services/brokerCapabilities.js; read-only, no new
//      backend endpoint). NOTE: no backend emits such an entry today and
//      GatewaysView does not fetch the registry, so this leg is parsed when
//      present but currently never fires — the live sources are (1) and (3).
//   3. the build-time VITE_FIX_RELAY_ENABLED value, kept only as a fallback
//      default for builds deployed without a runtime config.
//
// Precedence is runtime > capability environment > build flag. Anything
// unconfigured (missing, blank, or unrecognised) falls through, and the
// panel stays hidden unless some source explicitly enables it.

import { getRuntimeValue } from '../config/runtimeConfig.js';

export const FIX_RELAY_RUNTIME_KEYS = ['FIX_RELAY_ENABLED', 'VITE_FIX_RELAY_ENABLED'];

// Env names accepted for a deployment-gated entry in the broker capability
// registry environment list (see services/brokerCapabilities.js).
export const FIX_RELAY_ENV_NAMES = new Set(['FIX_RELAY_ENABLED', 'VITE_FIX_RELAY_ENABLED']);

const TRUE_VALUES = new Set(['true', '1', 'yes', 'y', 'on']);
const FALSE_VALUES = new Set(['false', '0', 'no', 'n', 'off']);

// Normalises a feature-switch value to true/false, or undefined when the
// source is unconfigured (missing, blank, or unrecognised) so the next
// source in the precedence chain applies.
export const normalizeFeatureFlag = (value) => {
  if (typeof value === 'boolean') return value;
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim().toLowerCase();
  if (text === '') return undefined;
  if (TRUE_VALUES.has(text)) return true;
  if (FALSE_VALUES.has(text)) return false;
  return undefined;
};

const readBuildFlag = (buildEnv) => {
  const env = buildEnv ?? (typeof import.meta !== 'undefined' ? import.meta.env : undefined);
  return normalizeFeatureFlag(env?.VITE_FIX_RELAY_ENABLED);
};

// Deployment-gated registry rows carry state 'enabled' | 'disabled' |
// 'invalid' | 'unobserved' (never hot-enabled). Only an explicit
// enabled/disabled state counts; anything else falls through to the build
// fallback so the panel stays closed instead of guessing.
export const capabilityEnvironmentRelayState = (environment) => {
  if (!Array.isArray(environment)) return undefined;
  const entry = environment.find(
    (item) =>
      item &&
      (FIX_RELAY_ENV_NAMES.has(item.env) || /fix[-_]?relay/i.test(String(item.key || ''))),
  );
  if (!entry) return undefined;
  const state = String(entry.state || '').trim().toLowerCase();
  if (state === 'enabled') return true;
  if (state === 'disabled') return false;
  return undefined;
};

// Panel visible iff the runtime capability is enabled. Default closed when
// every source is unconfigured; the build-time env is only a fallback.
export const isFixRelayEnabled = ({ runtimeConfig, capabilityEnvironment, buildEnv } = {}) => {
  const runtimeRaw =
    runtimeConfig !== undefined
      ? (runtimeConfig?.FIX_RELAY_ENABLED ?? runtimeConfig?.VITE_FIX_RELAY_ENABLED)
      : getRuntimeValue(...FIX_RELAY_RUNTIME_KEYS);
  const runtime = normalizeFeatureFlag(runtimeRaw);
  if (runtime !== undefined) return runtime;

  const environment = capabilityEnvironmentRelayState(capabilityEnvironment);
  if (environment !== undefined) return environment;

  return readBuildFlag(buildEnv) ?? false;
};

export const FIX_RELAY_TOOL = Object.freeze({
  section: 'readiness',
  id: 'relay',
  title: 'Superadmin FIX relay',
  description: 'Relay credentials, subscriptions and connection status',
});

// Builds the gateway tool list with the relay entry inserted ahead of the
// legacy feed whenever the capability is enabled, and stripped otherwise.
export const resolveGatewayTools = (baseTools, enabled = isFixRelayEnabled()) => {
  const base = Array.isArray(baseTools) ? baseTools : [];
  if (!enabled) return base.filter((tool) => tool?.id !== FIX_RELAY_TOOL.id);
  if (base.some((tool) => tool?.id === FIX_RELAY_TOOL.id)) return base;
  const legacyIndex = base.findIndex((tool) => tool?.section === 'legacy');
  if (legacyIndex === -1) return [...base, FIX_RELAY_TOOL];
  return [...base.slice(0, legacyIndex), FIX_RELAY_TOOL, ...base.slice(legacyIndex)];
};
