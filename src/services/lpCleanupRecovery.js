import {api} from '../lib/api.js';

// D01 cleanup recovery (Admin only). Reads the permitted recovery options for
// one escalated/held/reconcile_required cleanup plan and requests one audited
// action. A 202 is only an accepted request: it never means reconciled, sent,
// closed or flat. The server decides authority (actor_can_act) and the gate
// (mutations_enabled); this module never infers either.
const defaultRequest=async(path,options)=>{try{const r=await api.request({url:path,method:options.method,data:options.body?JSON.parse(options.body):undefined,_noRetry:true});return {ok:true,status:r.status,json:async()=>r.data};}catch(e){if(!e.response)throw e;return {ok:false,status:e.response.status,json:async()=>e.response.data};}};

const base='/api/v1/manager/lp-journal/';
export const CLEANUP_RECOVERY_PERMISSION='lp_cleanup_recovery';
export const CLEANUP_RECOVERY_NOTE_MAX=500;
export const cleanupRecoveryActions=['reconcile_original_ids','observe_original_position','acknowledge','authorize_recovery_round'];
export const cleanupRecoveryStatuses=['ready','held','escalated','reconcile_required','resolved_evidence'];
export const cleanupRecoveryActionable=['escalated','held','reconcile_required'];
export const cleanupRecoveryActionLabel={
 reconcile_original_ids:'Request saved-ID status read (H) of the original and every attempt',
 observe_original_position:'Request targeted position read (AN) of the original',
 acknowledge:'Record acknowledgement note (no state change)',
 authorize_recovery_round:'Authorize one bounded recovery round',
};
export const cleanupRecoveryForbiddenLabel={
 force_close_position:'Force-close the position',
 mark_flat:'Mark the position flat',
 edit_remaining_quantity:'Edit the remaining quantity',
 waive_or_zero_costs:'Waive or zero costs',
 book_customer:'Book the customer',
 release_configuration:'Release configuration',
 resend_same_clordid:'Resend the same ClOrdID',
 emergency_override:'Emergency override',
};
const reasonText={
 permitted:'Permitted by the current recorded facts.',
 plan_unavailable:'The cleanup plan is unavailable.',
 ineligible_scope:'Outside the broker-owned hedging rejected-opening scope.',
 customer_not_rejected:'The customer opening is not recorded as rejected.',
 plan_not_stopped:'The plan is not escalated or held.',
 recovery_read_settings_unconfigured:'Recovery read settings are not saved for this connection.',
 recovery_read_in_progress:'A recovery read is already in progress.',
 held_requires_evidence_resolution:'Evidence resolution required; recovery rounds are not available.',
 plan_not_escalated_by_limit:'Only a plan escalated by the attempt/deadline or price limit can get a round.',
 recovery_rounds_exhausted:'The recovery round budget is used.',
 remaining_invalid:'Recorded remaining is zero, invalid or above the original.',
 attempt_unreconciled:'An attempt is not terminal.',
 pinned_settings_changed:'The pinned cleanup settings no longer match the saved settings.',
 unresolved_reports_on_connection:'Unmatched reports exist on this connection.',
 stop_time_unavailable:'The stop time is unavailable.',
 original_id_reconciliation_required:'A completed saved-ID status read newer than the stop is required for the original and every attempt.',
 original_position_observation_required:'A completed targeted position read newer than the stop is required.',
 native_position_mismatch:'The observed native position does not exactly equal recorded remaining; investigation required.',
 unknown_action:'Unknown action.',
 invalid_request:'The request was not valid for the current plan.',
};
export const cleanupRecoveryReasonText=reason=>reasonText[reason]||'Not permitted by the server.';

const intentOK=value=>typeof value==='string'&&value.length>0&&value.length<=256&&!/[/\\\r\n\0]/.test(value);
const idOK=value=>typeof value==='string'&&value.length>0&&value.length<=256&&!/[\r\n\0]/.test(value);
export const planRevisionOK=value=>typeof value==='string'&&/^[1-9]\d{0,18}$/.test(value)&&BigInt(value)<=9223372036854775807n;
const exact=value=>typeof value==='string'&&value.length<=512&&/^\d+(\.\d+)?$/.test(value);
const count=value=>Number.isSafeInteger(value)&&value>=0;
const code=value=>typeof value==='string'&&/^[a-z][a-z0-9_]{0,63}$/.test(value);
const bytes=value=>new TextEncoder().encode(value).length;
const invalid=message=>{const e=Error(message);e.code='INVALID_RESPONSE';return e;};
const inputError=message=>{const e=Error(message);e.code='INVALID_INPUT';return e;};

export function validateCleanupRecovery(value,intentID){
 const v=value;
 if(!v||typeof v!=='object'||v.intent_id!==intentID||!idOK(v.plan_id)||!planRevisionOK(v.plan_revision))throw invalid('Cleanup recovery identity or plan revision is unavailable.');
 if(!cleanupRecoveryStatuses.includes(v.status)||!(v.escalation===''||v.escalation==null||code(v.escalation)))throw invalid('Cleanup recovery status is unavailable.');
 if(!exact(v.remaining)||!exact(v.attributable))throw invalid('Cleanup recovery quantities are unavailable.');
 if(![v.attempts,v.unreconciled_attempts,v.rounds_authorized,v.max_rounds].every(count)||v.unreconciled_attempts>v.attempts||v.max_rounds<1)throw invalid('Cleanup recovery counts are unavailable.');
 if(typeof v.mutations_enabled!=='boolean'||typeof v.actor_can_act!=='boolean')throw invalid('Cleanup recovery authority is unavailable.');
 if(v.required_permission!==CLEANUP_RECOVERY_PERMISSION)throw invalid('Cleanup recovery permission is unavailable.');
 if(!Array.isArray(v.options)||v.options.length!==cleanupRecoveryActions.length)throw invalid('Cleanup recovery options are unavailable.');
 const seen=new Set();
 for(const o of v.options){if(!o||!cleanupRecoveryActions.includes(o.action)||seen.has(o.action)||typeof o.permitted!=='boolean'||!code(o.reason)||o.permitted!==(o.reason==='permitted')||typeof o.mutating!=='boolean'||o.mutating!==(o.action==='authorize_recovery_round'))throw invalid('Cleanup recovery option is unavailable.');seen.add(o.action);}
 if(v.status==='held'&&v.options.some(o=>o.action==='authorize_recovery_round'&&o.permitted))throw invalid('A held plan cannot offer a recovery round.');
 if(!Array.isArray(v.forbidden_actions)||v.forbidden_actions.some(a=>!code(a)||cleanupRecoveryActions.includes(a)))throw invalid('Cleanup recovery forbidden list is unavailable.');
 return {intent_id:v.intent_id,plan_id:v.plan_id,plan_revision:v.plan_revision,status:v.status,escalation:v.escalation||'',remaining:v.remaining,attributable:v.attributable,attempts:v.attempts,unreconciled_attempts:v.unreconciled_attempts,rounds_authorized:v.rounds_authorized,max_rounds:v.max_rounds,mutations_enabled:v.mutations_enabled,actor_can_act:v.actor_can_act,required_permission:v.required_permission,options:v.options.map(o=>({action:o.action,permitted:o.permitted,reason:o.reason,mutating:o.mutating})),forbidden_actions:[...v.forbidden_actions]};
}

export function cleanupRecoveryPayload({action,expected_plan_revision,note}={}){
 if(!cleanupRecoveryActions.includes(action))throw inputError('Select a known recovery action.');
 if(!planRevisionOK(expected_plan_revision))throw inputError('Reload the cleanup plan revision before acting.');
 if(typeof note!=='string'||!note.trim())throw inputError('A note is required.');
 if(bytes(note)>CLEANUP_RECOVERY_NOTE_MAX||/\0/.test(note))throw inputError('The note must be at most 500 bytes.');
 return {action,expected_plan_revision,note};
}

export function validateCleanupRecoveryAccepted(status,value,action){
 const v=value;
 if(status!==202||!v||v.action!==action||v.accepted!==true||v.completed!==false)throw invalid('The recovery request was not confirmed as accepted. Reload before acting again.');
 const round=action==='authorize_recovery_round';
 if(round!==(v.round!=null))throw invalid('The recovery round was not confirmed. Reload before acting again.');
 if(!round)return {action:v.action,accepted:true,completed:false};
 const r=v.round;
 if(!Number.isSafeInteger(r.round)||r.round<1||!count(r.attempt_offset)||!Number.isSafeInteger(r.max_attempts)||r.max_attempts<1||r.max_attempts>10||typeof r.deadline!=='string'||Number.isNaN(Date.parse(r.deadline))||!exact(r.remaining))throw invalid('The recovery round was not confirmed. Reload before acting again.');
 return {action:v.action,accepted:true,completed:false,round:{round:r.round,attempt_offset:r.attempt_offset,max_attempts:r.max_attempts,deadline:r.deadline,remaining:r.remaining}};
}

export const cleanupRecoveryError=(code,reason)=>({
 LP_CLEANUP_RECOVERY_DISABLED:'Cleanup recovery actions are disabled on this server.',
 CLEANUP_PLAN_REVISION_CONFLICT:'The cleanup plan revision changed. Reload and review before acting.',
 CLEANUP_RECOVERY_NOT_PERMITTED:'This recovery action is not permitted now: '+(code==='CLEANUP_RECOVERY_NOT_PERMITTED'&&reason?reason+' - '+cleanupRecoveryReasonText(reason):'no reason recorded')+'.',
 LP_CLEANUP_RECOVERY_UNCONFIRMED:'The recovery request outcome is unconfirmed. Reload the journal entry before acting again.',
 LP_CLEANUP_RECOVERY_UNAVAILABLE:'Cleanup recovery is unavailable.',
 FORBIDDEN:'This account is not authorized for cleanup recovery.',
 LP_PERMISSION_DENIED:'This session is not authorized for cleanup recovery on this journal entry.',
 LP_FORBIDDEN:'A broker Admin or a granted manager session is required for cleanup recovery.',
 LP_JOURNAL_NOT_FOUND:'No visible journal entry matches this cleanup plan.',
 LP_INVALID_REQUEST:'Check the action, plan revision and note.',
 LP_CLEANUP_NOT_FOUND:'No cleanup plan is recorded for this journal entry.',
 INVALID_INPUT:'Check the action, plan revision and note.',
}[code]||'Cleanup recovery is unavailable.');

export function createLPCleanupRecoveryAPI(request=defaultRequest){
 const call=async(path,method='GET',payload)=>{let response;try{response=await request(path,{method,cache:'no-store',...(payload?{headers:{'content-type':'application/json'},body:JSON.stringify(payload)}:{})});}catch{throw Error('Cleanup recovery request failed.');}let data;try{data=await response.json();}catch{throw invalid('Invalid cleanup recovery response.');}if(!response.ok){const code=typeof data?.error_code==='string'?data.error_code:undefined;const reason=code==='CLEANUP_RECOVERY_NOT_PERMITTED'&&typeof data?.reason==='string'&&/^[a-z][a-z0-9_]{0,63}$/.test(data.reason)?data.reason:undefined;const e=Error(cleanupRecoveryError(code,reason));e.code=code;if(reason)e.reason=reason;throw e;}return {status:response.status,data};};
 const path=intentID=>{if(!intentOK(intentID))throw inputError('Invalid journal identity.');return base+encodeURIComponent(intentID)+'/cleanup-recovery';};
 return {
  get:async intentID=>validateCleanupRecovery((await call(path(intentID))).data,intentID),
  act:async(intentID,input)=>{const target=path(intentID)+'/actions';const payload=cleanupRecoveryPayload(input);const {status,data}=await call(target,'POST',payload);return validateCleanupRecoveryAccepted(status,data,payload.action);},
 };
}
export const lpCleanupRecovery=createLPCleanupRecoveryAPI();
