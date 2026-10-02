import { api } from '../lib/api.js';

const identifier = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value);
const integer = (value, maximum) => Number.isSafeInteger(value) && value >= 0 && value <= maximum;
const quantity = value => typeof value === 'string' && value.length <= 128 && /^(0|[1-9]\d*)(\.\d{1,18})?$/.test(value) && (!value.includes('.') || !value.endsWith('0')) && value !== '0';
const samePosition = (a, b) => a.symbol_id === b.symbol_id && a.side === b.side && a.wire_quantity === b.wire_quantity;

const reconciliationErrors = {
  LP_POSITION_ORIGIN_CHANGED: 'The saved connection now refers to a different provider account from the recorded positions. Review the connection and its original allocations before comparing again.',
  LP_POSITION_LEDGER_CHANGED: 'Recorded exposure changed during the provider read. Inspect again to compare a fresh observation.',
  LP_POSITION_SNAPSHOT_UNAVAILABLE: 'A complete current provider position observation is unavailable. Check the trade connection and inspect again.',
  LP_POSITION_LEDGER_UNAVAILABLE: 'Recorded position evidence is unavailable or unresolved. Review the execution journal before comparing again.',
  LP_POSITION_RECONCILIATION_UNAVAILABLE: 'Position inspection is unavailable for this connection. Check its saved configuration and connected trade session.',
  LP_PERMISSION_DENIED: 'Your current permissions do not allow provider position inspection.',
  LP_FORBIDDEN: 'A broker administrator session for this tenant is required to inspect provider positions.',
  FORBIDDEN: 'A broker administrator session for this tenant is required to inspect provider positions.',
  LP_INVALID_REQUEST: 'Refresh the saved providers and select a current connection before inspecting.',
  INVALID_INPUT: 'Refresh the saved providers and select a current connection before inspecting.',
  LP_INVALID_RESPONSE: 'The provider position response could not be verified. Refresh the saved providers and inspect again.',
  LP_PROXY_UNAVAILABLE: 'The provider inspection service could not be reached. Inspect again when the connection is available.',
};
export const positionReconciliationErrorMessage = code => typeof code === 'string' && Object.hasOwn(reconciliationErrors, code) ? reconciliationErrors[code] : 'Current provider positions could not be compared. Refresh the saved providers and inspect again.';

export function validatePositionReconciliation(value, connectionID, now = Date.now(), expectedRevision) {
  const fail = () => { throw new Error('Current position reconciliation evidence is unavailable.'); };
  if (!value || value.connection_id !== connectionID || !identifier(connectionID) || !identifier(value.request_id) || !integer(value.connection_revision, Number.MAX_SAFE_INTEGER) || value.connection_revision < 1 || (expectedRevision !== undefined && value.connection_revision !== expectedRevision) || value.orders_checked !== false || typeof value.positions_flat_observed !== 'boolean') fail();
  const dates = ['requested_at', 'completed_at', 'valid_until'].map(key => typeof value[key] === 'string' ? Date.parse(value[key]) : NaN);
  const [requested, completed, until] = dates;
  if (!dates.every(Number.isFinite) || requested > completed || completed > now || until <= now || until <= completed || until - completed > 30000) fail();
  const comparison = value.comparison;
  if (!comparison || typeof comparison.matched !== 'boolean' || !integer(comparison.expected_count, 4096) || !integer(comparison.observed_count, 1024) || !integer(comparison.unresolved, Number.MAX_SAFE_INTEGER) || !Array.isArray(comparison.discrepancies) || comparison.discrepancies.length > 5120 || value.positions_flat_observed !== (comparison.observed_count === 0) || comparison.matched !== (comparison.unresolved === 0 && comparison.discrepancies.length === 0)) fail();
  const seen = new Set();
  let expectedDiscrepancies = 0, observedDiscrepancies = 0;
  for (const discrepancy of comparison.discrepancies) {
    if (!discrepancy || !identifier(discrepancy.position_id) || seen.has(discrepancy.position_id)) fail();
    seen.add(discrepancy.position_id);
    for (const position of [discrepancy.expected, discrepancy.observed]) {
      if (position != null && (position.position_id !== discrepancy.position_id || !identifier(position.symbol_id) || !['buy', 'sell'].includes(position.side) || !quantity(position.wire_quantity))) fail();
    }
    if (discrepancy.expected != null) expectedDiscrepancies++;
    if (discrepancy.observed != null) observedDiscrepancies++;
    if (discrepancy.reason === 'missing_at_lp') {
      if (discrepancy.expected == null || discrepancy.observed != null) fail();
    } else if (discrepancy.reason === 'unmapped_at_lp') {
      if (discrepancy.observed == null || discrepancy.expected != null) fail();
    } else if (discrepancy.reason === 'position_differs') {
      if (discrepancy.expected == null || discrepancy.observed == null || samePosition(discrepancy.expected, discrepancy.observed)) fail();
    } else fail();
  }
  if (expectedDiscrepancies > comparison.expected_count || observedDiscrepancies > comparison.observed_count || comparison.expected_count - expectedDiscrepancies !== comparison.observed_count - observedDiscrepancies) fail();
  return value;
}

export function createLPPositionReconciliation(request = async path => (await api.get(path, {_noRetry: true})).data, clock = Date.now) {
  return { get: async (connectionID, expectedRevision) => {
    if (!identifier(connectionID)) throw new Error('Select a saved provider connection.');
    let value;
    try { value = await request('/api/v1/manager/lp-connections/' + encodeURIComponent(connectionID) + '/position-reconciliation'); }
    catch (error) { throw new Error(positionReconciliationErrorMessage(error?.response?.data?.error_code || error?.code)); }
    return validatePositionReconciliation(value, connectionID, clock(), expectedRevision);
  } };
}
export const lpPositionReconciliation = createLPPositionReconciliation();
