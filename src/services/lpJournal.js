import { api } from '../lib/api.js';
const defaultRequest=async(path,options)=>{try{const r=await api.request({url:path,method:options.method,data:options.body?JSON.parse(options.body):undefined,_noRetry:true});return {ok:true,json:async()=>r.data};}catch(error){if(!error.response)throw error;return {ok:false,json:async()=>error.response.data};}};

const base = '/api/v1/manager/lp-journal';
const exact = value => typeof value === 'string' && /^\d+(\.\d+)?$/.test(value);
const revision = value => typeof value === 'string' && /^[1-9]\d*$/.test(value) && BigInt(value) <= 9223372036854775807n;
const intent = value => { if (typeof value !== 'string' || !value || value.length > 256 || /[/\\\r\n\0]/.test(value)) throw new Error('Invalid journal identity.'); return encodeURIComponent(value); };
export const exposureColumns = [ ['known_wire_qty','Known executed'], ['customer_assigned_wire_qty','Customer assigned'], ['awaiting_customer_wire_qty','Awaiting customer'], ['intentional_excess_wire_qty','Intentional broker excess'], ['exception_wire_qty','Broker exception'], ['unresolved_wire_qty','Unresolved'] ];
export function journalState(entry) {
 if (entry.reconciliation_required) return 'Reconciliation hold';
 if (entry.booking_ref && entry.customer_status === 'filled') return 'Customer booked';
 if (entry.phase === 'fully_executed' && entry.customer_status === 'pending') return 'LP full · awaiting customer booking';
 return ({prepared:'Pending dispatch',unknown:'Execution unknown',working:'LP working',zero_rejected:'Rejected · zero executed',exposure_exception:'Rejected · broker exposure',operation_confirmed:'Operation confirmed',operation_rejected:'Operation rejected',reconciliation_hold:'Reconciliation hold'})[entry.phase] || entry.phase || 'State unavailable';
}
export function validateExposure(event, entry) {
 if (!event || event.intent_id !== entry.intent_id || event.connection_id !== entry.connection_id || event.account_id !== entry.account_id || !revision(event.revision) || !exposureColumns.every(([key])=>exact(event[key])) || !exact(event.units_per_lot) || !exact(event.average_price) || (event.cumulative_fee != null && (typeof event.cumulative_fee !== 'string' || !/^-?\d+(\.\d+)?$/.test(event.cumulative_fee)))) throw new Error('Exposure identity or exact quantities are unavailable.');
 return event;
}
export function validateCleanup(c){if(c==null)return;const money=x=>typeof x==='string'&&/^-?\d+(\.\d+)?$/.test(x);if(!revision(c.revision)||!revision(c.original_revision)||!['ready','held','escalated','reconcile_required','resolved_evidence'].includes(c.status)||![c.original_wire_qty,c.confirmed_closed_wire_qty,c.recorded_remaining_wire_qty,c.max_deviation_bps].every(exact)||typeof c.remaining_unresolved!=='boolean'||!Number.isInteger(c.max_attempts)||c.max_attempts<1||c.max_attempts>10||!Array.isArray(c.attempts)||c.attempts.length>c.max_attempts||!Array.isArray(c.accounting)||c.accounting.length>200)throw Error('Cleanup evidence is unavailable.');for(const a of c.attempts)if(![a.requested_wire_qty,a.confirmed_wire_qty,a.quote_price].every(exact)||!['unknown','terminal'].includes(a.status))throw Error('Cleanup attempt is unavailable.');for(const a of c.accounting)if(!revision(a.sequence)||!revision(a.plan_revision)||BigInt(a.plan_revision)>BigInt(c.revision)||!['complete','pending_reconciliation'].includes(a.status)||(a.status==='complete'&&(!money(a.profit)||!exact(a.costs)||!/^[A-Z][A-Z0-9]{1,11}$/.test(a.currency)))||(a.status==='pending_reconciliation'&&(a.profit!=null||a.costs!=null)))throw Error('Broker accounting evidence is unavailable.');}
export function validatePositionLifecycle(p) {
 if(p==null)return;
 const quantities=['customer_remaining_raw_volume','customer_remaining_wire_qty','customer_closed_wire_qty','reported_close_wire_qty','unsettled_reduction_wire_qty','intentional_excess_wire_qty'];
 if(!quantities.every(k=>exact(p[k])&&p[k].length<=512)||!Number.isSafeInteger(p.active_closes)||p.active_closes<0||typeof p.held_evidence!=='boolean'||typeof p.reconciliation_required!=='boolean'||!(p.reported_remaining_wire_qty===null||(exact(p.reported_remaining_wire_qty)&&p.reported_remaining_wire_qty.length<=512))||(p.held_evidence&&p.reported_remaining_wire_qty!==null)||((p.held_evidence||p.active_closes>0||!/^0(?:\.0+)?$/.test(p.unsettled_reduction_wire_qty))&&!p.reconciliation_required))throw Error('Remaining position evidence is unavailable.');
}
export function validateJournalEntry(entry) {
 validateNativePending(entry?.native_pending);
 if(entry?.native_pending&&entry.native_pending.customer_status!==entry.customer_status)throw Error("Native pending customer state changed.");
 if(entry?.native_pending?.latest_projection&&revision(entry.revision)&&BigInt(entry.native_pending.latest_projection.original_revision)>BigInt(entry.revision))throw Error("Native pending journal revision changed.");
 validateClosedRecovery(entry?.closed_recovery);
 validateClosedAllocation(entry?.closed_allocation);
 validateReportRisk(entry?.report_risk);
 validatePositionLifecycle(entry?.position_lifecycle);
 validateCleanup(entry?.cleanup);
 intent(entry?.intent_id);
 if (!revision(entry.revision) || !revision(entry.command_id) || !entry.connection_id || !entry.quote_connection_id || !entry.account_id || !exact(entry.cumulative_wire_qty) || !exact(entry.leaves_wire_qty) || !exact(entry.average_price)) throw new Error('Journal identity or exact quantities are unavailable.');
 if (entry.exposure && validateExposure(entry.exposure,entry).revision !== entry.revision) throw new Error('Journal revision changed. Refresh this entry.');
 return entry;
}
export const reportRiskReasons = {
 report_origin_unknown: 'Report for an unknown order',
 report_origin_untrusted: 'Report source could not be verified',
 report_origin_mismatched: 'Report source does not match the original order',
 unknown_cleanup_report: 'Unmatched cleanup report',
 conflicting_cleanup_report: 'Conflicting cleanup execution evidence',
 conflicting_close_report: 'Conflicting close execution evidence',
 provider_report_conflict: 'Conflicting provider execution evidence',
};
export function validateReportRisk(r) {
 if(r==null)return;
 const count=v=>typeof v==='string'&&/^(0|[1-9]\d*)$/.test(v)&&v.length<=19&&BigInt(v)<=9223372036854775807n;
 if(!count(r.trusted_incident_count)||!count(r.ambiguous_incident_count)||typeof r.blocked!=='boolean'||!Array.isArray(r.reason_codes)||r.reason_codes.length>7||new Set(r.reason_codes).size!==r.reason_codes.length||!r.reason_codes.every(code=>Object.hasOwn(reportRiskReasons,code)))throw Error('Report reconciliation evidence is unavailable.');
 const blocked=BigInt(r.trusted_incident_count)>0n||BigInt(r.ambiguous_incident_count)>0n;
 if(r.blocked!==blocked||(blocked&&(r.reason_codes.length===0||typeof r.latest_incident_at!=='string'||r.latest_incident_at.length>40||!Number.isFinite(Date.parse(r.latest_incident_at))))||(!blocked&&(r.reason_codes.length!==0||r.latest_incident_at!==null)))throw Error('Report reconciliation evidence is unavailable.');
}
export function createLPJournal(request=defaultRequest) {
 const call=async path=>{const response=await request(base+path,{method:'GET',cache:'no-store'});const value=await response.json();if(!response.ok)throw new Error(value?.error_code==='LP_PERMISSION_DENIED'?'Your current LP grant does not allow this journal.':value?.error_code==='LP_INVALID_REQUEST'?'The journal cursor or grant changed. Refresh the first page.':'The journal is unavailable or outside your current scope.');return value;};
 return {
  list:async(cursor='')=>{const value=await call(cursor?'?cursor='+encodeURIComponent(cursor):'');if(!Array.isArray(value.entries)||typeof value.next_cursor!=='string')throw new Error('Invalid journal page.');value.entries.forEach(validateJournalEntry);return value;},
  get:async id=>{const value=await call('/'+intent(id));validateJournalEntry(value.entry);if(value.entry.intent_id!==id)throw new Error('Journal identity changed.');return value.entry;},
  history:async(entry,after='')=>{const value=await call('/'+intent(entry.intent_id)+'/history'+(after?'?after_revision='+encodeURIComponent(after):''));if(value.intent_id!==entry.intent_id||value.connection_id!==entry.connection_id||value.account_id!==entry.account_id||!Array.isArray(value.events))throw new Error('History source identity changed.');let previous=BigInt(after||'0');for(const event of value.events){validateExposure(event,entry);if(BigInt(event.revision)<=previous)throw new Error('History is not ordered.');previous=BigInt(event.revision);}if(typeof value.next_revision!=='string'||(value.next_revision&&value.next_revision!==String(previous)))throw new Error('Invalid history cursor.');return value;}
 };
}
export const lpJournal=createLPJournal();
export function validateClosedRecovery(r){
 if(r==null)return;
 const count=v=>typeof v==='string'&&/^(0|[1-9]\d*)$/.test(v)&&v.length<=19&&BigInt(v)<=9223372036854775807n;
 const date=v=>typeof v==='string'&&v.length<=40&&Number.isFinite(Date.parse(v));
 if(!['ready','policy_unconfigured','claimed','unknown','released'].includes(r.state)||!count(r.attempt)||!(r.settings_revision===null||(count(r.settings_revision)&&r.settings_revision!=='0'))||!date(r.next_attempt_at)||!(r.deadline===null||date(r.deadline))||typeof r.paced!=='boolean'||typeof r.release_recorded!=='boolean'||r.release_recorded!==(r.state==='released'))throw Error('Closed allocation recovery schedule is unavailable.');
 if((r.state==='released'&&r.paced)||(['ready','policy_unconfigured'].includes(r.state)&&(r.attempt!=='0'||r.settings_revision!==null||r.deadline!==null||(r.state==='policy_unconfigured'&&r.paced)))||(['claimed','unknown','released'].includes(r.state)&&(r.attempt==='0'||r.settings_revision===null||r.deadline===null)))throw Error('Closed allocation recovery schedule is inconsistent.');
}

export function validateClosedAllocation(c) {
 if(c==null)return;
 const count=v=>typeof v==='string'&&/^(0|[1-9]\d*)$/.test(v)&&v.length<=19&&BigInt(v)<=9223372036854775807n;
 const date=v=>typeof v==='string'&&v.length<=40&&Number.isFinite(Date.parse(v));
 const decimal=v=>typeof v==='string'&&v.length<=512&&/^\d+(\.\d+)?$/.test(v);
 const money=v=>typeof v==='string'&&v.length<=512&&/^-?\d+(\.\d+)?$/.test(v);
 if(!count(c.certificate_count)||c.certificate_count==='0'||!count(c.connection_revision)||c.connection_revision==='0'||!date(c.created_at)||!date(c.native_observed_at)||!date(c.native_valid_until)||Date.parse(c.native_valid_until)<=Date.parse(c.native_observed_at)||!decimal(c.certified_raw_volume)||!decimal(c.certified_wire_quantity)||!['in_flight','pending','open','unknown','exposure','released','unavailable'].includes(c.configuration_use_state)||typeof c.release_recorded!=='boolean'||!(c.released_at===null||date(c.released_at))||c.release_recorded!==(c.released_at!==null)||c.financial_status!=='pending_reconciliation'||!count(c.pending_fee_count)||!count(c.observed_fee_count)||!Array.isArray(c.fees)||c.fees.length>100||typeof c.fees_truncated!=='boolean')throw Error('Historical close certificate is unavailable.');
 const total=BigInt(c.pending_fee_count)+BigInt(c.observed_fee_count);if(total>9223372036854775807n||c.fees_truncated!==(total>100n)||BigInt(c.fees.length)!==(total>100n?100n:total))throw Error('Native fee follow-up count is unavailable.');
 let pending=0n,observed=0n;
 for(const f of c.fees){if(!date(f.created_at)||!(f.amount===null||money(f.amount))||!(f.currency===null||(typeof f.currency==='string'&&/^[A-Z][A-Z0-9]{1,11}$/.test(f.currency))))throw Error('Native fee evidence is unavailable.');if(f.status==='pending_evidence'){pending++;if(f.amount!==null||f.currency!==null)throw Error('Unknown native fees must remain unknown.');}else if(f.status==='observed_unreconciled'){observed++;if(f.amount===null)throw Error('Observed native fee amount missing.');}else throw Error('Native fee state is unavailable.');}
 if(pending>BigInt(c.pending_fee_count)||observed>BigInt(c.observed_fee_count))throw Error('Native fee count mismatch.');
}

export function validateNativePending(p){
 if(p==null)return;
 const date=v=>typeof v==='string'&&v.length<=40&&Number.isFinite(Date.parse(v));
 const decimal=v=>exact(v)&&v.length<=512;
 const terms=t=>{if(!t||!['GTC','GTD'].includes(t.time_in_force))return false;const price=p.order_type==='limit'?t.limit_price:t.stop_price,other=p.order_type==='limit'?t.stop_price:t.limit_price;return decimal(price)&&!/^0(?:\.0+)?$/.test(price)&&!other&&(t.time_in_force==='GTC'?(!t.expire_time||t.expire_time==='GTC'):date(t.expire_time));};
 if(!revision(p.revision)||!['limit','stop'].includes(p.order_type)||!['prepared','unknown','working','fully_executed','zero_rejected','exposure_exception','reconciliation_hold'].includes(p.phase)||!['pending','rejected','filled'].includes(p.customer_status)||!['','filled','canceled','expired','rejected'].includes(p.terminal_status)||![p.target_wire_qty,p.cumulative_wire_qty,p.leaves_wire_qty,p.average_price].every(decimal)||!(p.cumulative_fee===null||(typeof p.cumulative_fee==='string'&&p.cumulative_fee.length<=512&&/^-?\d+(\.\d+)?$/.test(p.cumulative_fee)))||!['possibly_sent','held','reconciliation_required','controls_truncated'].every(k=>typeof p[k]==='boolean')||(p.held&&!p.reconciliation_required)||!terms(p.terms)||!Array.isArray(p.controls)||p.controls.length>20||(p.controls_truncated&&p.controls.length!==20))throw Error('Native pending evidence is unavailable.');
 if(p.latest_projection!==null){const l=p.latest_projection;if(!l||!revision(l.pending_revision)||!revision(l.original_revision)||BigInt(l.pending_revision)>BigInt(p.revision)||!['execution_alias_v1','control_only_v1'].includes(l.normalization))throw Error('Native pending projection link is unavailable.');}
 const seen=new Set();let previous=null;
 for(const c of p.controls){if(!revision(c.command_id)||seen.has(c.command_id)||!revision(c.base_revision)||BigInt(c.base_revision)>BigInt(p.revision)||!['cancel','replace'].includes(c.action)||!['prepared','unknown','confirmed','rejected','held'].includes(c.state)||!date(c.created_at)||!(c.possible_at===null||date(c.possible_at))||!terms(c.terms)||(c.state==='prepared'&&c.possible_at!==null)||(['unknown','confirmed','rejected'].includes(c.state)&&c.possible_at===null)||(c.state==='held'&&(!p.held||!p.reconciliation_required))||(c.possible_at!==null&&Date.parse(c.possible_at)<Date.parse(c.created_at)))throw Error('Native pending control evidence is unavailable.');
  if(previous&&(Date.parse(c.created_at)>Date.parse(previous.created_at)||(c.created_at===previous.created_at&&BigInt(c.command_id)>=BigInt(previous.command_id))))throw Error('Native pending control ordering is unavailable.');seen.add(c.command_id);previous=c;
 }
}
