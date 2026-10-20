import { api } from '../lib/api.js';
import {
  GROUP_LEVERAGE_MAX,
  GROUP_LEVERAGE_MIN,
  buildBrokerGroupDefaultsBody,
  normalizeBrokerGroupDefaults,
} from '../utils/brokerGroupDefaults.js';

// Broker-wide defaults for newly created groups (today: default leverage).
//
// Backend contract (manager-backend):
//   GET /api/v1/manager/broker/group-defaults   (server_admin or manage_groups)
//   PUT /api/v1/manager/broker/group-defaults   (server_admin)
// Tenant scope: the backend derives the broker from the session, so this
// client NEVER sends broker_id. PUT body is exactly
// { group_default_leverage: int MIN..MAX | null } (null clears the default).
// 200 body (GET and PUT): { broker_id, group_default_leverage: int | null }.
// Errors: { message, code, stackTrace }; known codes map to the texts below.

export const BROKER_GROUP_DEFAULTS_PATH = '/api/v1/manager/broker/group-defaults';
export const BROKER_GROUP_DEFAULTS_READ_TIMEOUT_MS = 8000;

const BROKER_GROUP_DEFAULTS_MESSAGES = Object.freeze({
  GROUP_POLICY_DEFAULT_INVALID: `Default leverage must be a whole number from ${GROUP_LEVERAGE_MIN} to ${GROUP_LEVERAGE_MAX}, or blank to clear it. Nothing was saved.`,
  MT_RET_ERR_PERMISSIONS: 'Your session lacks the permission for broker defaults (reading needs server_admin or manage_groups; saving needs server_admin).',
  GROUP_DEFAULTS_TENANT_FORBIDDEN: 'This session may only read and configure its own broker. Sign in with the owning broker admin.',
  GROUP_DEFAULTS_BROKER_UNKNOWN: 'The broker of this session does not exist.',
  GROUP_DEFAULTS_MIGRATION_MISSING: 'Broker defaults storage is unavailable: the required database migration is not applied on this backend.',
  GROUP_DEFAULTS_UNAVAILABLE: 'Broker defaults are temporarily unavailable. Try again.',
});

export const brokerGroupDefaultsError = (code, fallback) =>
  BROKER_GROUP_DEFAULTS_MESSAGES[code] || fallback || 'Broker defaults are unavailable.';

// Known codes get operator text; anything else (unknown code, network, raw
// driver message) gets the generic fallback, never the backend text.
const throwMappedError = (error, fallback) => {
  const code = error?.response?.data?.code ?? (typeof error?.code === 'string' && BROKER_GROUP_DEFAULTS_MESSAGES[error.code] ? error.code : undefined);
  const mapped = new Error(brokerGroupDefaultsError(code, fallback));
  if (code) mapped.code = code;
  mapped.status = error?.response?.status;
  mapped.cause = error;
  throw mapped;
};

export function createBrokerGroupDefaultsApi(client = api) {
  const get = async () => {
    let res;
    try {
      res = await client.get(BROKER_GROUP_DEFAULTS_PATH, { timeout: BROKER_GROUP_DEFAULTS_READ_TIMEOUT_MS });
    } catch (error) {
      throwMappedError(error, 'Unable to load the broker defaults.');
    }
    return normalizeBrokerGroupDefaults(res?.data);
  };

  // input: blank/null clears, otherwise a whole number MIN..MAX. Invalid input
  // is refused locally (no request). Returns the re-read effective value.
  const save = async (input) => {
    const body = buildBrokerGroupDefaultsBody(input);
    let res;
    try {
      res = await client.put(BROKER_GROUP_DEFAULTS_PATH, body, { _noRetry: true });
    } catch (error) {
      throwMappedError(error, 'Unable to save the default leverage.');
    }
    const stored = normalizeBrokerGroupDefaults(res?.data);
    const verified = await get();
    if (verified.defaultLeverage !== stored.defaultLeverage) {
      const mismatch = new Error('The saved default leverage did not verify: the stored value differs. Reload and review.');
      mismatch.code = 'GROUP_DEFAULTS_VERIFY_MISMATCH';
      throw mismatch;
    }
    return verified;
  };

  return { get, save };
}

export const BrokerGroupDefaultsApi = createBrokerGroupDefaultsApi();

export default BrokerGroupDefaultsApi;
