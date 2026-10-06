import { api } from '../lib/api.js';

export const exposureSummaryColumns = [
  ['known_wire_qty', 'Executed opening'],
  ['customer_assigned_wire_qty', 'Customer assigned'],
  ['awaiting_customer_wire_qty', 'Awaiting customer'],
  ['intentional_excess_wire_qty', 'Broker excess'],
  ['exception_wire_qty', 'Broker exception'],
  ['unresolved_wire_qty', 'Unresolved opening'],
];
const count = value => typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value) && value.length <= 19 && BigInt(value) <= 9223372036854775807n;
const decimal = value => typeof value === 'string' && value.length <= 512 && /^\d+(\.\d{1,18})?$/.test(value);
const identity = value => typeof value === 'string' && value.length > 0 && value.length <= 256 && !/[\r\n\0]/.test(value);

export function validateExposureSummary(value) {
  if (!value || typeof value.as_of !== 'string' || !Number.isFinite(Date.parse(value.as_of)) || !count(value.intent_count) || !count(value.missing_attribution_count) || !Array.isArray(value.groups) || value.groups.length > 2000) throw new Error('Complete exposure totals are unavailable.');
  let covered = BigInt(value.missing_attribution_count);
  for (const group of value.groups) {
    if (!group || ![group.connection_id, group.provider, group.symbol].every(identity) || !['buy', 'sell'].includes(group.side) || !decimal(group.units_per_lot) || !/[1-9]/.test(group.units_per_lot) || !['intent_count', 'reconciliation_count', 'remaining_unknown_count'].every(key => count(group[key])) || group.intent_count === '0' || BigInt(group.reconciliation_count) > BigInt(group.intent_count) || BigInt(group.remaining_unknown_count) > BigInt(group.intent_count) || !exposureSummaryColumns.every(([key]) => decimal(group[key]))) throw new Error('Exposure identity or exact totals are unavailable.');
    if (group.remaining_unknown_count !== '0' ? group.recorded_remaining_wire_qty !== null : !decimal(group.recorded_remaining_wire_qty)) throw new Error('Remaining exposure certainty is unavailable.');
    covered += BigInt(group.intent_count);
  }
  if (covered !== BigInt(value.intent_count)) throw new Error('The exposure book is incomplete.');
  return value;
}

export function createLPExposureSummary(request = async () => (await api.get('/api/v1/manager/lp-journal/exposure', {_noRetry: true})).data) {
  return { get: async () => validateExposureSummary(await request()) };
}
export const lpExposureSummary = createLPExposureSummary();
