import {api} from '../lib/api.js';

// A-book native pending Admin enablement (migration 339). One immutable
// revision per saved connection + instrument, saved with an expected-revision
// CAS and bound to the exact reviewed evidence revision. Default is off.
const defaultRequest=async(path,options)=>{try{const r=await api.request({url:path,method:options.method,data:options.body?JSON.parse(options.body):undefined,_noRetry:true});return {ok:true,json:async()=>r.data};}catch(e){if(!e.response)throw e;return {ok:false,json:async()=>e.response.data};}};

const base='/api/v1/manager/lp-routing/native-pending-enablements/';
export const NATIVE_PENDING_APPLICATION='new_native_pending_placements_only';
const noControl=value=>![...value].some(c=>{const n=c.charCodeAt(0);return n<32||n===127;});
const idOK=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value);
const symbolOK=value=>typeof value==='string'&&value!==''&&value.length<=128&&value.trim()===value&&!/[/\\?#]/.test(value)&&noControl(value);
const revisionOK=(value,min=0)=>typeof value==='string'&&/^(0|[1-9]\d{0,18})$/.test(value)&&BigInt(value)<9223372036854775807n&&BigInt(value)>=BigInt(min);
const bindingOK=value=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);
const reasonOK=value=>typeof value==='string'&&value.length>=8&&value.length<=256&&noControl(value)&&value.trim()===value;

export const emptyNativePendingDraft=()=>({enabled:false,allow_limit:false,allow_stop:false,allow_gtc:false,allow_gtd:false,reason:''});

export function nativePendingEnablementPayload(expectedRevision,evidenceRevision,draft){
 if(!revisionOK(expectedRevision))throw Error('Reload the saved enablement revision.');
 const flags=['allow_limit','allow_stop','allow_gtc','allow_gtd'];
 if(typeof draft?.enabled!=='boolean'||flags.some(k=>typeof draft[k]!=='boolean'))throw Error('Choose every enablement option explicitly.');
 if(!reasonOK(draft.reason))throw Error('Enter a reason of 8-256 characters without leading or trailing spaces.');
 if(draft.enabled){
  if(!(draft.allow_limit||draft.allow_stop))throw Error('Enable at least one evidenced order type (limit or stop).');
  if(!(draft.allow_gtc||draft.allow_gtd))throw Error('Enable at least one evidenced expiry policy (GTC or GTD).');
  if(!revisionOK(evidenceRevision,1))throw Error('Load current instrument evidence before enabling.');
 }
 const payload={expected_revision:expectedRevision,enabled:draft.enabled,allow_limit:false,allow_stop:false,allow_gtc:false,allow_gtd:false,evidence_revision:draft.enabled?evidenceRevision:'0',reason:draft.reason};
 if(draft.enabled)for(const k of flags)payload[k]=draft[k];
 return payload;
}

export function validateNativePendingEnablementResponse(value,connection,symbol){
 const s=value?.status;
 if(typeof value?.configured!=='boolean'||value.application!==NATIVE_PENDING_APPLICATION||!s||!revisionOK(s.current_evidence_revision)||typeof s.binding_current!=='boolean'||typeof s.cancel_evidence_current!=='boolean'||typeof s.effective!=='boolean'||(s.current_binding!==undefined&&!bindingOK(s.current_binding)))throw Error('Invalid native pending enablement.');
 if(!value.configured){if(s.saved!==null||s.effective||s.binding_current)throw Error('Invalid native pending enablement.');return value;}
 const r=s.saved;
 if(!r||r.connection_id!==connection||r.symbol!==symbol||!revisionOK(r.revision,1)||!revisionOK(r.connection_revision)||!revisionOK(r.evidence_revision)||!revisionOK(r.actor_login,1)||!reasonOK(r.reason)||typeof r.created_at!=='string'||!Number.isFinite(Date.parse(r.created_at)))throw Error('Invalid native pending enablement.');
 if(r.enabled){if(!(r.allow_limit||r.allow_stop)||!(r.allow_gtc||r.allow_gtd)||!bindingOK(r.capability_binding)||typeof r.native_pending_evidence_id!=='string'||!r.native_pending_evidence_id)throw Error('Invalid native pending enablement.');}
 else if(r.allow_limit||r.allow_stop||r.allow_gtc||r.allow_gtd||r.capability_binding||s.effective)throw Error('Invalid native pending enablement.');
 return value;
}

// A save is confirmed only by a new revision (above the expected one) that
// records exactly the submitted choice; an echo of the prior record is not.
export function nativePendingSaveConfirmed(value,payload){
 const r=value?.configured?value.status?.saved:null;
 if(!r||BigInt(r.revision)<=BigInt(payload.expected_revision)||r.enabled!==payload.enabled)return false;
 if(['allow_limit','allow_stop','allow_gtc','allow_gtd'].some(k=>r[k]!==payload[k]))return false;
 return !payload.enabled||r.evidence_revision===payload.evidence_revision;
}

const prerequisite={
 NATIVE_PENDING_CONNECTION_NOT_ELIGIBLE:'The connection must be an enabled hedging cServer connection with quote and trade sessions enabled.',
 NATIVE_PENDING_NATIVE_PENDING_EVIDENCE_INVALID:'Current native pending evidence is missing, expired or invalid for this connection.',
 NATIVE_PENDING_EXACT_DEMO_SIZING_EVIDENCE:'This instrument uses operator-exact demo sizing, which is market-only. Native pending needs verified grid evidence.',
 NATIVE_PENDING_ORDER_TERMS_NOT_EVIDENCED:'A selected order type or expiry policy is not supported by the saved evidence.',
 NATIVE_PENDING_NATIVE_CANCEL_EVIDENCE_REQUIRED:'Save current native cancellation evidence before enabling placement.',
 NATIVE_PENDING_CLEANUP_POLICY_REQUIRED:'Save the connection cleanup policy first.',
 NATIVE_PENDING_PENDING_READ_POLICY_REQUIRED:'Save a recovery read policy with a pending read maximum age first.',
 NATIVE_PENDING_REPORT_RISK_UNRESOLVED:'Resolve report incidents on this connection first.',
 NATIVE_PENDING_UNRESOLVED_CONNECTION_INTENTS:'Reconcile unknown or held LP intents on this connection first.',
};
export const nativePendingEnablementError=code=>prerequisite[code]||({
 CONFIGURATION_CONFLICT:'The saved enablement or evidence changed. Reload and review before saving.',
 NATIVE_PENDING_ENABLEMENT_UNAVAILABLE:'Migration 339 or its storage is unavailable; native pending placement stays off.',
 ROUTING_NOT_FOUND:'The connection was not found.',
 ROUTING_EVIDENCE_INVALID:'The saved instrument evidence is invalid.',
 INVALID_INPUT:'Check every option, the reason and the revisions.',
 FORBIDDEN:'Only a broker Admin can change native pending enablement.',
 LP_FORBIDDEN:'Only a broker Admin can change native pending enablement.',
}[code])||'Native pending enablement is unavailable.';

export function createLPNativePendingEnablementAPI(request=defaultRequest){
 const call=async(path,method='GET',payload)=>{let response;try{response=await request(path,{method,cache:'no-store',...(payload?{headers:{'content-type':'application/json'},body:JSON.stringify(payload)}:{})});}catch{throw Error('Native pending enablement request failed.');}let data;try{data=await response.json();}catch{throw Error('Invalid native pending enablement response.');}if(!response.ok){const e=Error(nativePendingEnablementError(data?.error_code||data?.error));e.code=data?.error_code||data?.error;throw e;}return data;};
 const target=(connection,symbol)=>{if(!idOK(connection)||!symbolOK(symbol))throw Error('Select saved instrument evidence.');return base+encodeURIComponent(connection)+'/'+encodeURIComponent(symbol);};
 return {
  instruments:async()=>{const v=await call('/api/v1/manager/lp-routing/evidence');if(!Array.isArray(v?.evidence))throw Error('Instrument evidence is unavailable.');return v.evidence.filter(e=>idOK(e?.connection_id)&&symbolOK(e?.symbol)).map(e=>({connection:e.connection_id,symbol:e.symbol,revision:String(e.revision),nativePending:!!e.native_pending,nativeCancel:!!e.native_control?.supports_cancel,exactDemo:!!e.exact_demo_sizing}));},
  get:async(connection,symbol)=>validateNativePendingEnablementResponse(await call(target(connection,symbol)),connection,symbol),
  save:async(connection,symbol,expectedRevision,evidenceRevision,draft)=>{const path=target(connection,symbol);const payload=nativePendingEnablementPayload(expectedRevision,evidenceRevision,draft);const v=validateNativePendingEnablementResponse(await call(path,'PUT',payload),connection,symbol);if(!nativePendingSaveConfirmed(v,payload))throw Error('Saved enablement was not confirmed. Reload before another save.');return v;},
 };
}
export const lpNativePendingEnablement=createLPNativePendingEnablementAPI();
