import {api} from '../lib/api.js';

// LP-independent B-book private FIX readiness (R15/R17 G6/G7). B-book is
// always private FIX and never needs a named LP connection, so this read has
// no connection ID. The view carries states, counts and one derived code only.
const defaultRequest=async(path,options)=>{try{const r=await api.request({url:path,method:options.method,_noRetry:true});return {ok:true,json:async()=>r.data};}catch(e){if(!e.response)throw e;return {ok:false,json:async()=>e.response.data};}};

const path='/api/v1/manager/runtime/private-fix';
const bool=value=>typeof value==='boolean';
const count=value=>Number.isSafeInteger(value)&&value>=0;
const time=value=>typeof value==='string'&&!Number.isNaN(Date.parse(value));

export const PRIVATE_FIX_CODES={
 '':'Ready.',
 DEPLOYMENT_INVALID:'RTX5_INTERNAL_FIX_ENABLED has an invalid value; the Gateway refuses private FIX.',
 DEPLOYMENT_DISABLED:'Private FIX is not enabled for this Gateway (protected deployment step).',
 SESSION_NOT_CONFIGURED:'Private FIX is enabled but no session is configured for this broker.',
 DISPATCH_SCHEMA_MISSING:'The private FIX dispatch schema is missing; B-book orders fail closed.',
 ADAPTER_NOT_COMPOSED:'The private FIX adapter is not composed in this Gateway.',
 SERVICE_STOPPED:'The Gateway order command service is stopped.',
 SESSION_DISCONNECTED:'The private FIX session is disconnected.',
 RECOVERY_BACKLOG_UNAVAILABLE:'The recovery backlog could not be read.',
};

export function validatePrivateFIXReadiness(value){
 const b=value?.recovery_backlog;
 if(!value||typeof value.tenant_id!=='string'||!value.tenant_id||!time(value.observed_at)||!time(value.expires_at)||value.named_lp_required!==false||
  !['enabled','disabled','invalid'].includes(value.deployment)||!['not_configured','connected','disconnected'].includes(value.session)||
  ![value.configured,value.dispatch_schema_ready,value.composed,value.lifecycle_live,value.claiming,value.ready].every(bool)||
  !Object.hasOwn(PRIVATE_FIX_CODES,value.last_error_code)||!b||!bool(b.available)||!bool(b.truncated)||
  ![b.unacknowledged,b.possibly_sent,b.oldest_age_seconds].every(count)||b.possibly_sent>b.unacknowledged||
  (value.session==='not_configured')===value.configured||(value.ready&&(value.last_error_code!==''||value.session!=='connected')))throw Error('Invalid private FIX readiness response.');
 return value;
}

export const privateFIXError=code=>({
 LP_PROXY_UNAVAILABLE:'The trading gateway is unreachable from the manager service.',
 LP_INVALID_RESPONSE:'Private FIX readiness answered with an invalid response.',
 LP_FORBIDDEN:'This account cannot view private FIX readiness.',
 LP_PERMISSION_DENIED:'This account cannot view private FIX readiness.',
}[code]||'Private FIX readiness is unavailable.');

export function createPrivateFIXReadinessAPI(request=defaultRequest){
 return {get:async()=>{
  let response;try{response=await request(path,{method:'GET',cache:'no-store'});}catch{throw Error('Private FIX readiness request failed.');}
  let data;try{data=await response.json();}catch{throw Error('Invalid private FIX readiness response.');}
  if(!response.ok){const code=data?.error_code??data?.error;const e=Error(privateFIXError(code));e.code=typeof code==='string'?code:undefined;throw e;}
  return validatePrivateFIXReadiness(data);
 }};
}
export const privateFixReadiness=createPrivateFIXReadinessAPI();
