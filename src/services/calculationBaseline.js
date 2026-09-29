const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
const exact = value => typeof value === 'string' && /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/.test(value);
const natural = value => typeof value === 'string' && /^(?:0|[1-9][0-9]*)$/.test(value);
export function baselineLogin(value) {
 const login = String(value).trim();
 if (!/^[1-9][0-9]{0,18}$/.test(login) || BigInt(login) > 9223372036854775807n) throw new Error('Enter a valid account login for this broker.');
 return login;
}
export function parseBaselineDraft(text) {
 if (typeof text !== 'string' || new TextEncoder().encode(text).length > 65536) throw new Error('The reviewed policy file must be at most 64 KB.');
 let draft;
 try { draft = JSON.parse(text); } catch { throw new Error('Select a valid policy JSON file.'); }
 if (!draft || typeof draft !== 'object' || Array.isArray(draft) || !Array.isArray(draft.accounts) || !draft.accounts.length) throw new Error('The policy must include the broker accounts.');
 const visit = value => {
  if (typeof value === 'number' && (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value)))) throw new Error('The policy contains a number that cannot be preserved exactly.');
  if (value && typeof value === 'object') Object.values(value).forEach(visit);
 };
 visit(draft);
 return draft;
}
export function readBaselineSources(value,scope) {
 let broker;
 try {broker=JSON.parse(scope)[1];} catch {throw new Error('An authenticated broker session is required.');}
 if(!value||value.kind!=='calculation_source_review'||value.importable!==false||value.broker_id!==broker||!hash(value.source_snapshot_hash)||typeof value.observed_at!=='string'||!Array.isArray(value.required_inputs)||!value.required_inputs.length||value.required_inputs.some(x=>typeof x!=='string'))throw new Error('The source review is incomplete or belongs to another broker.');
 for(const key of ['accounts_json','groups_json','instruments_json','symbol_overrides_json','hidden_markups_json','account_feeds_json','group_feeds_json']){
  if(!Array.isArray(value[key])||value[key].some(raw=>typeof raw!=='string'))throw new Error('Source values must preserve their exact text.');
  for(const raw of value[key]){try{const parsed=JSON.parse(raw);if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error();}catch{throw new Error('A source record is unreadable.');}}
 }
 return structuredClone(value);
}
export function baselineAccountMarginBoundary(settings) {
 if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw new Error('The proposed account settings are unavailable.');
 if (!Object.hasOwn(settings,'margin_rounding_boundary')) return 'symbol_total';
 if (settings.margin_rounding_boundary !== 'account_total') throw new Error('The proposed account margin rounding boundary is unsupported.');
 return 'account_total';
}
export function baselineAccountPricing(row, ready = true) {
 const nonnegative = value => exact(value) && !value.startsWith('-');
 if (!row || !nonnegative(row.current_hidden_opening_markup_points)) throw new Error('Current account pricing must preserve exact decimal points.');
 const proposed = row.proposed_calculation_settings;
 if (proposed === undefined) {
  if (ready) throw new Error('Review the proposed settings for every account before activation.');
  return {current:row.current_hidden_opening_markup_points,proposed:null};
 }
 if (!proposed || typeof proposed !== 'object' || Array.isArray(proposed) || proposed.currency !== row.currency || !Number.isInteger(proposed.currency_scale) || proposed.currency_scale < 0 || proposed.currency_scale > 18 || proposed.rounding_mode !== 'half_up' || !['hedging','netting'].includes(proposed.position_mode) || !nonnegative(proposed.lot_divisor) || !/[1-9]/.test(proposed.lot_divisor) || !nonnegative(proposed.leverage) || !/[1-9]/.test(proposed.leverage)) throw new Error('The proposed account calculation settings are incomplete.');
 baselineAccountMarginBoundary(proposed);
 const points = Object.hasOwn(proposed,'hidden_opening_markup_points') ? proposed.hidden_opening_markup_points : '0';
 if (!nonnegative(points)) throw new Error('Proposed account pricing must preserve exact decimal points.');
 return {current:row.current_hidden_opening_markup_points,proposed:points};
}
export function readBaselinePreview(value) {
 if (!value || typeof value.ready !== 'boolean' || typeof value.broker_id !== 'string' || !value.broker_id || value.tenant_id !== value.broker_id || value.impact !== 'broker_wide_exact_calculation' || !Array.isArray(value.accounts) || !Array.isArray(value.blockers) || value.blockers.some(x => typeof x !== 'string')) throw new Error('The baseline review response is incomplete.');
 if (value.ready && (!hash(value.fingerprint) || !hash(value.settings_export_hash) || !value.accounts.length || value.blockers.length)) throw new Error('The baseline review is not ready for activation.');
 if (value.economic_equivalence !== 'operator_review_required' || !Array.isArray(value.settings_review) || !Array.isArray(value.proposed_commissions) || (value.ready && !value.settings_review.length)) throw new Error('Review the current and proposed calculation settings before activation.');
 for (const row of value.settings_review) {
  if (!row || typeof row.group_name !== 'string' || !row.group_name || typeof row.symbol !== 'string' || !row.symbol || !row.proposed || typeof row.proposed !== 'object' || Array.isArray(row.proposed)) throw new Error('The calculation settings review is incomplete.');
  for (const field of ['current_instrument_json','current_group_json','current_symbol_override_json']) {
   if (typeof row[field] !== 'string') throw new Error('Current calculation settings must preserve their exact values.');
   try { JSON.parse(row[field]); } catch { throw new Error('Current calculation settings are unreadable.'); }
  }
 }
 const ids = new Set();
 for (const row of value.accounts) {
  if (!row || typeof row.account_id !== 'string' || !row.account_id || ids.has(row.account_id) || typeof row.account_login !== 'string' || !baselineLogin(row.account_login) || typeof row.group !== 'string' || typeof row.currency !== 'string' || !row.currency || !exact(row.balance) || !exact(row.credit) || !(natural(row.account_revision) || (!value.ready && row.account_revision === '-1'))) throw new Error('An account baseline cannot be represented exactly.');
  ids.add(row.account_id);
  baselineAccountPricing(row,value.ready);
  if (row.proposed_calculation_settings && baselineAccountMarginBoundary(row.proposed_calculation_settings)==='account_total') {
   const symbols=value.settings_review.filter(setting=>setting.group_name===row.group);
   if (!symbols.length || symbols.some(setting=>setting.proposed.margin_rounding_boundary!=='symbol_total')) throw new Error('Account-total margin requires every reviewed group symbol to use symbol-total rounding.');
  }
  for (const name of ['open_positions','pending_orders','unresolved_commands']) if (!Number.isSafeInteger(row[name]) || row[name] < 0 || (value.ready && row[name] !== 0)) throw new Error('Outstanding account activity prevents baseline activation.');
 }
 return structuredClone(value);
}
function storageKey(scope) {
 let identity;
 try { identity = JSON.parse(scope); } catch { throw new Error('An authenticated broker administrator session is required.'); }
 if (!Array.isArray(identity) || identity.length < 2 || !identity[0] || typeof identity[1] !== 'string' || !identity[1]) throw new Error('An authenticated broker administrator session is required.');
 return 'rtx5.calculation-baseline.v1:' + encodeURIComponent(JSON.stringify(identity.slice(0,2)));
}
export function readBaselinePending(storage, scope) {
 const raw = storage?.getItem(storageKey(scope));
 if (!raw) return null;
 let record;
 try { record = JSON.parse(raw); } catch { throw new Error('The saved baseline activation identity is unreadable. Review it before another activation.'); }
 if (!record || record.version !== 1 || !hash(record.fingerprint) || !hash(record.settings_export_hash) || typeof record.broker_id !== 'string' || record.broker_id !== JSON.parse(scope)[1] || typeof record.account_login !== 'string' || !baselineLogin(record.account_login)) throw new Error('The saved baseline activation identity is invalid.');
 return record;
}
export function saveBaselinePending(storage, scope, login, preview) {
 if (!storage || readBaselinePending(storage, scope)) throw new Error('Resolve the saved activation before starting another.');
 const checked = readBaselinePreview(preview);
 if (!checked.ready || checked.broker_id !== JSON.parse(scope)[1]) throw new Error('Review the current broker baseline before activating.');
 const record = {version:1,broker_id:checked.broker_id,account_login:baselineLogin(login),fingerprint:checked.fingerprint,settings_export_hash:checked.settings_export_hash};
 const raw = JSON.stringify(record), key = storageKey(scope);
 storage.setItem(key,raw);
 if (storage.getItem(key) !== raw) throw new Error('The original activation could not be saved. No activation was sent.');
 return record;
}
export function readBaselineStatus(value, record) {
 if (!value || value.fingerprint !== record.fingerprint || !['absent','active','pending','conflict'].includes(value.status)) throw new Error('The original baseline status is unavailable.');
 if (value.status === 'active' && (!value.release || value.release.state !== 'ACTIVE' || value.release.broker_id !== record.broker_id || value.release.tenant_id !== record.broker_id || value.release.settings_export_hash !== record.settings_export_hash)) throw new Error('The active baseline does not match the reviewed policy.');
 return value;
}
export function clearBaselinePending(storage, scope, record, status) {
 readBaselineStatus(status,record);
 if (status.status !== 'active') throw new Error('Activation remains unresolved.');
 const saved = readBaselinePending(storage,scope);
 if (!saved || saved.fingerprint !== record.fingerprint) throw new Error('The saved activation identity changed.');
 storage.removeItem(storageKey(scope));
 if (storage.getItem(storageKey(scope)) !== null) throw new Error('The completed activation record could not be cleared.');
}

export async function withBaselineWriteLock(locks,scope,operation) {
 if (!locks || typeof locks.request !== 'function') throw new Error('This browser cannot coordinate baseline activation between tabs.');
 return locks.request(storageKey(scope),{mode:'exclusive',ifAvailable:true},async lock=>{
  if(!lock)throw new Error('Another tab is processing a baseline activation. Check the original activation status.');
  return operation();
 });
}
// A refused calculation-policy request. A 403 keeps the server's explicit
// reason (message and/or error code); the generic authority text is used
// only when the server gave none. Other failures stay "not confirmed".
const REFUSAL_REASONS = {
 POLICY_RELEASE_AUTHORITY_REVOKED: 'Current broker administrator authority for this account is not held: the session was revoked or the account is not in this broker.',
 LP_PERMISSION_DENIED: 'This Admin session does not hold current broker administrator authority.',
};
const refusalText = value => typeof value === 'string' && value.trim() && !value.trim().startsWith('<') ? value.trim().slice(0, 300) : '';
export function readCalculationRefusal(response) {
 if (Number(response?.status) !== 403) return 'The baseline request was not confirmed. Review the current state before continuing.';
 const data = response?.data;
 const message = typeof data === 'string' ? refusalText(data) : refusalText(data?.message);
 const code = typeof data === 'object' && data ? refusalText(data.error_code) || refusalText(data.code) || refusalText(data.error) : '';
 const reason = message || REFUSAL_REASONS[code] || '';
 if (!reason) return code ? `Current broker administrator authority is required (${code}).` : 'Current broker administrator authority is required.';
 return code && !reason.includes(code) ? `${reason.replace(/[\s.]+$/, '')} (${code}).` : reason;
}
