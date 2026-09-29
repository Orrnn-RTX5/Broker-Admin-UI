// Separate additive calculation cutover (backend doc
// docs/lp-integration/C10-CALCULATION-SEPARATE-CUTOVER.md). Pure helpers: exact
// text preservation, strict review checks and a durable original identity.
import {baselineLogin} from './calculationBaseline.js';

const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const exact = value => typeof value === 'string' && /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/.test(value);
const natural = value => typeof value === 'string' && /^(?:0|[1-9][0-9]*)$/.test(value);
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
const KINDS = ['NEW_ACCOUNT','MOVED_ACCOUNT'];

export const CUTOVER_TEMPLATE = JSON.stringify({
 reason:'Describe why these accounts and symbols are added',
 accounts:[{account_id:'<new account UUID>',account_login:0,group_name:'<group>',calculation_settings:{currency:'USD',currency_scale:2,rounding_mode:'half_up',position_mode:'hedging',lot_divisor:'<exact>',leverage:'<exact>'}}],
 symbols:[{group_name:'<group>',symbol:'<SYMBOL>',calculation_settings:{}}],
 move_accounts:[]
},null,1);

export function parseCutoverDraft(text) {
 if (typeof text !== 'string' || new TextEncoder().encode(text).length > 65536) throw new Error('The reviewed cutover must be at most 64 KB.');
 let draft;
 try { draft = JSON.parse(text); } catch { throw new Error('Enter valid cutover JSON.'); }
 if (!draft || typeof draft !== 'object' || Array.isArray(draft)) throw new Error('The cutover must be a JSON object.');
 const allowed = ['reason','accounts','symbols','move_accounts'];
 if (Object.keys(draft).some(key => !allowed.includes(key))) throw new Error('The cutover contains an unsupported field.');
 if (typeof draft.reason !== 'string' || !draft.reason.trim() || draft.reason !== draft.reason.trim() || draft.reason.length > 512) throw new Error('Give a one-line reason for this cutover.');
 for (const key of ['accounts','symbols','move_accounts']) if (draft[key] !== undefined && !Array.isArray(draft[key])) throw new Error('Accounts, symbols and moved accounts must be lists.');
 if (!(draft.accounts?.length || draft.move_accounts?.length)) throw new Error('The cutover must name at least one new or moved account.');
 const visit = value => {
  if (typeof value === 'number' && (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value)))) throw new Error('The cutover contains a number that cannot be preserved exactly.');
  if (value && typeof value === 'object') Object.values(value).forEach(visit);
 };
 visit(draft);
 return draft;
}

export function readCutoverPreview(value) {
 if (!value || value.kind !== 'calculation_additive_cutover' || typeof value.ready !== 'boolean' || typeof value.broker_id !== 'string' || !value.broker_id ||
  value.impact !== 'scoped_additive_calculation_cutover' || value.economic_equivalence !== 'existing_definitions_unchanged' ||
  !Array.isArray(value.accounts) || !Array.isArray(value.blockers) || value.blockers.some(x => typeof x !== 'string') ||
  !Array.isArray(value.added_definitions) || !Array.isArray(value.settings_review) || !Array.isArray(value.other_accounts)) throw new Error('The cutover review response is incomplete.');
 if (value.ready && (!hash(value.fingerprint) || !hash(value.settings_export_hash) || !uuid(value.parent_policy_version_id) || !uuid(value.root_policy_version_id) ||
  !natural(value.parent_event_sequence) || value.parent_event_sequence === '0' || !value.accounts.length || value.blockers.length)) throw new Error('The cutover review is not ready to apply.');
 const ids = new Set();
 for (const row of value.accounts) {
  if (!row || !uuid(row.account_id) || ids.has(row.account_id) || typeof row.account_login !== 'string' || !baselineLogin(row.account_login) || typeof row.group !== 'string' ||
   typeof row.currency !== 'string' || !row.currency || !KINDS.includes(row.cutover_kind) || !(natural(row.account_revision) || (!value.ready && row.account_revision === '-1')) || !natural(row.checkpoint_source_revision) ||
   !exact(row.checkpoint_balance) || !exact(row.checkpoint_credit) || typeof row.checkpoint_source !== 'string' || !Array.isArray(row.gained_symbols) || row.gained_symbols.some(x => typeof x !== 'string'))
   throw new Error('A scoped account cannot be represented exactly.');
  if (row.cutover_kind === 'MOVED_ACCOUNT' && (!uuid(row.previous_assignment_id) || !uuid(row.current_policy_version_id))) throw new Error('A moved account must name its current assignment.');
  for (const name of ['open_positions','pending_orders','unresolved_commands','in_flight_lp_uses']) if (!Number.isSafeInteger(row[name]) || row[name] < 0 || (value.ready && row[name] !== 0)) throw new Error('Open positions, pending orders or in-flight work lock this cutover.');
  ids.add(row.account_id);
 }
 for (const row of value.added_definitions) if (!row || typeof row.key !== 'string' || !['account','symbol'].includes(row.kind) || !hash(row.hash) || typeof row.group_name !== 'string') throw new Error('An added definition is incomplete.');
 for (const row of value.settings_review) {
  if (!row || typeof row.group_name !== 'string' || typeof row.symbol !== 'string' || !row.proposed || typeof row.proposed !== 'object') throw new Error('The new symbol review is incomplete.');
  for (const field of ['current_instrument_json','current_group_json','current_symbol_override_json']) {
   if (typeof row[field] !== 'string') throw new Error('Current settings must preserve their exact values.');
   try { JSON.parse(row[field]); } catch { throw new Error('Current settings are unreadable.'); }
  }
 }
 for (const row of value.other_accounts) if (!row || typeof row.account_login !== 'string' || typeof row.reason !== 'string') throw new Error('The unaffected account list is incomplete.');
 return structuredClone(value);
}

function storageKey(scope) {
 let identity;
 try { identity = JSON.parse(scope); } catch { throw new Error('An authenticated broker administrator session is required.'); }
 if (!Array.isArray(identity) || identity.length < 2 || !identity[0] || typeof identity[1] !== 'string' || !identity[1]) throw new Error('An authenticated broker administrator session is required.');
 return 'rtx5.calculation-cutover.v1:' + encodeURIComponent(JSON.stringify(identity.slice(0,2)));
}
export function readCutoverPending(storage, scope) {
 const raw = storage?.getItem(storageKey(scope));
 if (!raw) return null;
 let record;
 try { record = JSON.parse(raw); } catch { throw new Error('The saved cutover identity is unreadable. Review it before another cutover.'); }
 if (!record || record.version !== 1 || !hash(record.fingerprint) || !hash(record.settings_export_hash) || !uuid(record.parent_policy_version_id) || typeof record.broker_id !== 'string' || record.broker_id !== JSON.parse(scope)[1] || typeof record.account_login !== 'string' || !baselineLogin(record.account_login)) throw new Error('The saved cutover identity is invalid.');
 return record;
}
export function saveCutoverPending(storage, scope, login, preview) {
 if (!storage || readCutoverPending(storage, scope)) throw new Error('Resolve the saved cutover before starting another.');
 const checked = readCutoverPreview(preview);
 if (!checked.ready || checked.broker_id !== JSON.parse(scope)[1]) throw new Error('Review the current cutover before applying it.');
 const record = {version:1,broker_id:checked.broker_id,account_login:baselineLogin(login),fingerprint:checked.fingerprint,settings_export_hash:checked.settings_export_hash,parent_policy_version_id:checked.parent_policy_version_id};
 const raw = JSON.stringify(record), key = storageKey(scope);
 storage.setItem(key,raw);
 if (storage.getItem(key) !== raw) throw new Error('The original cutover could not be saved. Nothing was sent.');
 return record;
}
export function readCutoverStatus(value, record) {
 if (!value || value.fingerprint !== record.fingerprint || !['absent','active','pending','conflict'].includes(value.status)) throw new Error('The original cutover status is unavailable.');
 if (value.status === 'active' && (!value.release || value.release.state !== 'ACTIVE' || value.release.broker_id !== record.broker_id || value.release.settings_export_hash !== record.settings_export_hash || value.release.impact_report_hash !== record.fingerprint)) throw new Error('The active cutover does not match the reviewed plan.');
 return value;
}
export function clearCutoverPending(storage, scope, record, status) {
 readCutoverStatus(status,record);
 if (status.status !== 'active') throw new Error('The cutover remains unresolved.');
 const saved = readCutoverPending(storage,scope);
 if (!saved || saved.fingerprint !== record.fingerprint) throw new Error('The saved cutover identity changed.');
 storage.removeItem(storageKey(scope));
 if (storage.getItem(storageKey(scope)) !== null) throw new Error('The completed cutover record could not be cleared.');
}
export async function withCutoverWriteLock(locks, scope, operation) {
 if (!locks || typeof locks.request !== 'function') throw new Error('This browser cannot coordinate the cutover between tabs.');
 return locks.request(storageKey(scope),{mode:'exclusive',ifAvailable:true},async lock=>{
  if(!lock)throw new Error('Another tab is processing a cutover. Check the original cutover status.');
  return operation();
 });
}
