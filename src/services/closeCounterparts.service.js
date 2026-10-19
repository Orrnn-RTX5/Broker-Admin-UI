import { api } from '../lib/api.js';

// Admin-owned view of the mandatory 516 close-counterpart mapping.
//
// Backend contract (manager-backend, migration 516):
//   GET /api/v1/manager/broker/close-counterparts?legal_entity_id=...
//   PUT /api/v1/manager/broker/close-counterparts   (POST is an idempotent alias)
// Auth: Bearer manager session + `server_admin` permission.
// Tenant scope: a tenant session is confined to its own broker/tenant and must
// NEVER send broker_id; the backend derives (broker, tenant) from the session.
// tenant_id may be omitted or must equal the session broker. A super-admin uses
// a different cross-broker contract which this Admin screen deliberately does
// not expose (tenant admin scope, no cross-broker reads/writes).
//
// Response (ManagerBrokerCloseCounterparts): broker_id, tenant_id,
// legal_entity_id, policy_version_id (canonical policy version whose chart
// validated the purposes), profit/swap/commission/fee_purpose, enabled,
// updated_by (manager login, 0 = migration/system), updated_at.
// A 404 with code CLOSE_COUNTERPARTS_UNCONFIGURED means no row exists and
// account onboarding keeps refusing with 422 ACCOUNT_ONBOARDING_CONFIG_MISSING.
// A disabled row is returned with enabled=false. Every effective change writes
// an append-only DB audit row (old/new mapping) and emits
// broker.close_counterparts.update; updated_at only moves on real change, so a
// repeated identical PUT is idempotent.

export const CLOSE_COUNTERPARTS_PATH = '/api/v1/manager/broker/close-counterparts';
export const CLOSE_COUNTERPARTS_READ_TIMEOUT_MS = 8000;

const PURPOSE_LIMIT = 128;
const SCOPE_LIMIT = 4096;
const CANONICAL_TEXT_RE = /^[\x21-\x7e]+$/;

export const CLOSE_COUNTERPART_PURPOSE_KEYS = Object.freeze([
  'profit_purpose',
  'swap_purpose',
  'commission_purpose',
  'fee_purpose',
]);

// Typed backend `code` values mapped to operator-facing messages. Unknown
// codes fall back to the backend message (never driver detail).
const CLOSE_COUNTERPART_MESSAGES = Object.freeze({
  CLOSE_COUNTERPARTS_UNCONFIGURED: 'No close-counterpart mapping exists for this legal entity. Account onboarding will keep failing until one is saved.',
  CLOSE_COUNTERPARTS_ENTITY_REQUIRED: 'Enter the legal entity whose chart is being configured.',
  CLOSE_COUNTERPARTS_BROKER_REQUIRED: 'The current session cannot name a broker. Sign in with a broker-scoped admin session.',
  CLOSE_COUNTERPARTS_TENANT_REQUIRED: 'The current session cannot name a tenant. Sign in with a broker-scoped admin session.',
  CLOSE_COUNTERPARTS_TENANT_FORBIDDEN: 'This session may only read and configure its own broker. Sign in with the owning broker admin.',
  CLOSE_COUNTERPARTS_INVALID: 'Check the legal entity and the four purposes: each must be non-empty printable text without spaces (max 128 characters).',
  CLOSE_COUNTERPARTS_PURPOSE_UNKNOWN: 'At least one purpose is not a SYSTEM-scoped chart account of this legal entity\u2019s active canonical policy. Nothing was saved.',
  CLOSE_COUNTERPARTS_NO_ACTIVE_POLICY: 'This broker, tenant and legal entity have no active canonical policy, so purposes cannot be validated. Nothing was saved.',
  CLOSE_COUNTERPARTS_POLICY_AMBIGUOUS: 'The current canonical policy is ambiguous. Nothing was saved; retry after the policy head is resolved.',
  CLOSE_COUNTERPARTS_POLICY_CHANGED: 'The canonical policy changed while validating. Nothing was saved; reload and retry.',
  CLOSE_COUNTERPARTS_BROKER_UNKNOWN: 'The broker does not exist.',
  CLOSE_COUNTERPARTS_MIGRATION_MISSING: 'Close-counterpart storage is unavailable: migration 516 is not applied on this backend.',
  CLOSE_COUNTERPARTS_UNAVAILABLE: 'Close-counterpart configuration is temporarily unavailable. Try again.',
  MT_RET_ERR_PERMISSIONS: 'Your session lacks the server_admin grant for close-counterpart configuration.',
  ACCOUNT_ONBOARDING_CONFIG_MISSING: 'Account onboarding is refused until the close-counterpart mapping is configured below.',
});

export const closeCounterpartsError = (code, fallback) =>
  CLOSE_COUNTERPART_MESSAGES[code] || fallback || 'Close-counterpart configuration is unavailable.';

export const isCanonicalCloseCounterpartPurpose = (value) => {
  const text = String(value ?? '').trim();
  return text !== '' && text.length <= PURPOSE_LIMIT && CANONICAL_TEXT_RE.test(text);
};

export const isCanonicalCloseCounterpartScope = (value, limit = SCOPE_LIMIT) => {
  const text = String(value ?? '').trim();
  return text !== '' && text.length <= limit && CANONICAL_TEXT_RE.test(text);
};

const readErrorCode = (error) => error?.response?.data?.code ?? error?.code;

// Throws a typed Error whose `code` is the backend code (when present) and
// whose message is operator-facing. 404/UNCONFIGURED on read is NOT thrown by
// `get` — it resolves to null so the panel can render the empty state.
const throwMappedError = (error, fallback) => {
  const code = readErrorCode(error);
  // Known codes always use the operator-facing text; the raw backend message
  // is only a fallback for codes this screen does not know yet.
  const backendMessage = typeof error?.response?.data?.message === 'string' && error.response.data.message.trim()
    ? error.response.data.message.trim()
    : '';
  const message = (code && CLOSE_COUNTERPART_MESSAGES[code]) || backendMessage || closeCounterpartsError(code, fallback);
  const mapped = new Error(message);
  if (code) mapped.code = code;
  mapped.status = error?.response?.status;
  mapped.cause = error;
  throw mapped;
};

export const normalizeCloseCounterpartsView = (value) => {
  if (!value || typeof value !== 'object') throw new Error('Invalid close-counterpart mapping response.');
  for (const key of ['broker_id', 'tenant_id', 'legal_entity_id', 'policy_version_id', ...CLOSE_COUNTERPART_PURPOSE_KEYS]) {
    if (typeof value[key] !== 'string' || !value[key].trim()) throw new Error('Invalid close-counterpart mapping response.');
  }
  if (typeof value.enabled !== 'boolean') throw new Error('Invalid close-counterpart mapping response.');
  return { ...value };
};

export function createCloseCounterpartsApi(client = api) {
  // Tenant-scoped read of one (broker, tenant, legal entity) mapping.
  // Resolves to null when unconfigured (typed 404), throws otherwise.
  const get = async (legalEntityId) => {
    const entity = String(legalEntityId ?? '').trim();
    if (!isCanonicalCloseCounterpartScope(entity)) {
      throw new Error(closeCounterpartsError('CLOSE_COUNTERPARTS_ENTITY_REQUIRED'));
    }
    let res;
    try {
      res = await client.get(CLOSE_COUNTERPARTS_PATH, {
        params: { legal_entity_id: entity },
        timeout: CLOSE_COUNTERPARTS_READ_TIMEOUT_MS,
        _expectedStatuses: [404],
      });
    } catch (error) {
      if (error?.response?.status === 404 && readErrorCode(error) === 'CLOSE_COUNTERPARTS_UNCONFIGURED') return null;
      throwMappedError(error, 'Unable to load the close-counterpart mapping.');
    }
    return normalizeCloseCounterpartsView(res.data);
  };

  // Tenant-scoped idempotent upsert. tenantId is sent only when the caller
  // knows the session broker (it must equal the session broker); broker_id is
  // never sent from this Admin screen. Returns the stored mapping, then
  // re-reads it (verify) so the caller can confirm the effective row.
  const save = async ({ tenantId, legalEntityId, purposes, enabled = true }) => {
    const entity = String(legalEntityId ?? '').trim();
    if (!isCanonicalCloseCounterpartScope(entity)) {
      throw new Error(closeCounterpartsError('CLOSE_COUNTERPARTS_ENTITY_REQUIRED'));
    }
    const tenant = String(tenantId ?? '').trim();
    if (tenant && !isCanonicalCloseCounterpartScope(tenant)) {
      throw new Error(closeCounterpartsError('CLOSE_COUNTERPARTS_INVALID'));
    }
    const body = { legal_entity_id: entity };
    if (tenant) body.tenant_id = tenant;
    for (const key of CLOSE_COUNTERPART_PURPOSE_KEYS) {
      const purpose = String(purposes?.[key] ?? '').trim();
      if (!isCanonicalCloseCounterpartPurpose(purpose)) {
        const fieldError = new Error(closeCounterpartsError('CLOSE_COUNTERPARTS_INVALID'));
        fieldError.field = key;
        throw fieldError;
      }
      body[key] = purpose;
    }
    body.enabled = enabled !== false;
    let res;
    try {
      // PUT is the primary writer; POST is a backend compatibility alias.
      res = await client.put(CLOSE_COUNTERPARTS_PATH, body, { _noRetry: true });
    } catch (error) {
      throwMappedError(error, 'Unable to save the close-counterpart mapping.');
    }
    const stored = normalizeCloseCounterpartsView(res.data);
    // Verify: re-read the effective row and confirm the saved purposes took.
    let verified = null;
    try {
      verified = await get(entity);
    } catch {
      verified = null;
    }
    if (verified && CLOSE_COUNTERPART_PURPOSE_KEYS.some((key) => verified[key] !== stored[key])) {
      const mismatch = new Error('The saved mapping did not verify: the stored purposes differ. Reload and review.');
      mismatch.code = 'CLOSE_COUNTERPARTS_VERIFY_MISMATCH';
      mismatch.stored = stored;
      mismatch.verified = verified;
      throw mismatch;
    }
    return { stored, verified: verified ?? stored };
  };

  return { get, save };
}

export const CloseCounterpartsApi = createCloseCounterpartsApi();

export default CloseCounterpartsApi;
