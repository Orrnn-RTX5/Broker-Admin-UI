import {api} from '../lib/api.js';

// Broker capability registry (R15/R17 G4/G5/G14). The server computes every
// state and reason: this module only validates the wire shape, builds the
// strict change body and maps error codes. Effective state is
// desired AND prerequisites AND compiled-in; nothing here derives it.
const defaultRequest=async(path,options)=>{try{const r=await api.request({url:path,method:options.method,data:options.body?JSON.parse(options.body):undefined,_noRetry:true});return {ok:true,json:async()=>r.data};}catch(e){if(!e.response)throw e;return {ok:false,json:async()=>e.response.data};}};

const base='/api/v1/manager/runtime/capabilities';
export const CAPABILITY_KEYS=['exact_pending_modify','exact_named_protection','d01_recovery_actions','cleanup_physical_closure'];
export const ENV_STATES=['enabled','disabled','invalid','unobserved'];
const REASON_CODES=new Set(['DESIRED_OFF','NOT_COMPILED_IN','REGISTRY_STORAGE_UNAVAILABLE','MIGRATION_LEDGER_UNAVAILABLE','MIGRATION_NOT_APPLIED','VERIFICATION_RECEIPTS_UNAVAILABLE','VERIFICATION_RECEIPT_MISSING','DEPENDENCY_NOT_EFFECTIVE','DECISION_PENDING','ACTIVE_BUSINESS_CONFLICT','BUSINESS_CHECK_UNAVAILABLE','COMPILED_IN_MISMATCH']);
const ENV_REASONS=new Set(['ENV_ENABLED','ENV_DISABLED','ENV_INVALID','OWNER_UNOBSERVED','ENV_ENABLED_CODE_GATED']);
const OWNERS=new Set(['gateway','bridge','manager']);
const revisionOK=value=>typeof value==='string'&&/^(0|[1-9]\d{0,15})$/.test(value)&&Number(value)<Number.MAX_SAFE_INTEGER;
const text=(value,max)=>typeof value==='string'&&value.length>0&&value.length<=max;
const bool=value=>typeof value==='boolean';

export const CAPABILITY_REASON_MIN=8;
export const CAPABILITY_REASON_MAX=256;

export function capabilityReason(value){
 const v=typeof value==='string'?value:'';
 if(v!==v.trim()||v.length<CAPABILITY_REASON_MIN||v.length>CAPABILITY_REASON_MAX||[...v].some(ch=>ch.charCodeAt(0)<32||ch.charCodeAt(0)===127))throw Error(`Enter a reason of ${CAPABILITY_REASON_MIN} to ${CAPABILITY_REASON_MAX} characters on one line.`);
 return v;
}

export function capabilityChangePayload(revision,desiredEnabled,reason){
 if(!revisionOK(revision))throw Error('Reload the capability revision.');
 if(!bool(desiredEnabled))throw Error('Choose on or off.');
 return {expected_revision:revision,desired_enabled:desiredEnabled,reason:capabilityReason(reason)};
}

function validReasons(list){
 return Array.isArray(list)&&list.length<=32&&list.every(r=>r&&REASON_CODES.has(r.code)&&(r.subject===undefined||(typeof r.subject==='string'&&r.subject.length<=128))&&text(r.required_step,512));
}

function validCapability(c,key){
 return c&&c.key===key&&text(c.title,160)&&(c.owner==='gateway'||c.owner==='bridge')&&text(c.compiled_constant,96)&&
  [c.compiled_in,c.desired_enabled,c.prerequisites_met,c.effective,c.conflict_readable,c.effective_requires_compiled_in].every(bool)&&
  revisionOK(c.revision)&&validReasons(c.reasons)&&validReasons(c.change_blockers)&&Array.isArray(c.required_migrations)&&
  Array.isArray(c.depends_on)&&Array.isArray(c.pending_decisions)&&Number.isSafeInteger(c.conflict_in_flight)&&c.conflict_in_flight>=0&&
  // effective is exactly the conjunction; the UI never shows a looser claim.
  c.effective===(c.desired_enabled&&c.prerequisites_met&&c.compiled_in);
}

function validEnv(f){
 return f&&text(f.key,64)&&text(f.title,160)&&text(f.env,96)&&OWNERS.has(f.owner)&&ENV_STATES.includes(f.state)&&ENV_REASONS.has(f.reason_code)&&text(f.required_step,512)&&f.hot_enable===false;
}

export function validateCapabilitiesResponse(value){
 if(!value||!text(value.tenant_id,96)||!bool(value.registry_ready)||value.change_authority!=='broker_admin'||!Array.isArray(value.capabilities)||
  value.capabilities.length!==CAPABILITY_KEYS.length||!value.capabilities.every((c,i)=>validCapability(c,CAPABILITY_KEYS[i]))||
  !Array.isArray(value.environment)||value.environment.length>32||!value.environment.every(validEnv))throw Error('Invalid capability registry response.');
 if(!value.registry_ready&&value.capabilities.some(c=>c.desired_enabled||c.effective))throw Error('Invalid capability registry response.');
 return value;
}

export const capabilityError=code=>({
 CONFIGURATION_CONFLICT:'The capability changed since it was loaded. Reload and review before another change.',
 CAPABILITY_UNCHANGED:'That desired state is already recorded. Reload to see the current revision.',
 CONFIGURATION_IN_USE:'Conflicting business is in flight. Wait until it resolves, then reload.',
 CAPABILITY_BUSINESS_UNAVAILABLE:'In-flight business could not be checked, so the change was refused. Retry later.',
 CAPABILITY_REGISTRY_UNAVAILABLE:'Migration 338 or its storage is unavailable; every capability stays off.',
 CAPABILITY_UNKNOWN:'Unknown capability. Reload the registry.',
 INVALID_INPUT:`Enter a reason of ${CAPABILITY_REASON_MIN} to ${CAPABILITY_REASON_MAX} characters and reload the revision.`,
 LP_PROXY_UNAVAILABLE:'The trading gateway is unreachable from the manager service.',
 LP_INVALID_RESPONSE:'The capability registry answered with an invalid response.',
 FORBIDDEN:'Only a broker Admin can view or change capabilities.',
 LP_FORBIDDEN:'Only a broker Admin can view or change capabilities.',
 LP_PERMISSION_DENIED:'Only a broker Admin can view or change capabilities.',
}[code]||'The capability registry is unavailable.');

export function createBrokerCapabilitiesAPI(request=defaultRequest){
 const call=async(path,method='GET',payload)=>{let response;try{response=await request(path,{method,cache:'no-store',...(payload?{headers:{'content-type':'application/json'},body:JSON.stringify(payload)}:{})});}catch{throw Error('Capability registry request failed.');}let data;try{data=await response.json();}catch{throw Error('Invalid capability registry response.');}if(!response.ok){const code=data?.error_code??data?.error;const e=Error(capabilityError(code));e.code=typeof code==='string'?code:undefined;throw e;}return data;};
 return {
  get:async()=>validateCapabilitiesResponse(await call(base)),
  change:async(key,revision,desiredEnabled,reason)=>{
   if(!CAPABILITY_KEYS.includes(key))throw Error(capabilityError('CAPABILITY_UNKNOWN'));
   const payload=capabilityChangePayload(revision,desiredEnabled,reason);
   const v=validateCapabilitiesResponse(await call(`${base}/${key}`,'PUT',payload));
   const saved=v.capabilities.find(c=>c.key===key);
   if(!saved||saved.desired_enabled!==desiredEnabled||Number(saved.revision)<=Number(revision))throw Error('The change was not confirmed. Reload before another change.');
   return v;
  },
 };
}
export const brokerCapabilities=createBrokerCapabilitiesAPI();
