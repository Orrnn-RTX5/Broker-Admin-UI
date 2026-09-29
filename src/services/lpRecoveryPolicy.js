import {api} from '../lib/api.js';
const defaultRequest=async(path,options)=>{try{const r=await api.request({url:path,method:options.method,data:options.body?JSON.parse(options.body):undefined,_noRetry:true});return {ok:true,json:async()=>r.data};}catch(e){if(!e.response)throw e;return {ok:false,json:async()=>e.response.data};}};

const base='/api/v1/manager/lp-routing/recovery-policies/';
const idOK=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value);
const revisionOK=value=>typeof value==='string'&&/^(0|[1-9]\d*)$/.test(value)&&BigInt(value)<9223372036854775807n;
export const emptyRecoveryPolicy=()=>({timeout_ms:'',rate_window_ms:'',max_requests:'',max_pending:'',pending_max_age_ms:''});
export function recoveryPolicyFields(value){
 const result={};
 for(const [key,max] of [['timeout_ms',3000],['rate_window_ms',3600000],['max_requests',1000],['max_pending',16]]){const v=value[key];if(!((typeof v==='string'&&/^[1-9]\d*$/.test(v))||Number.isSafeInteger(v))||Number(v)<1||Number(v)>max)throw Error('Enter explicit recovery read limits within the displayed bounds.');result[key]=Number(v);}
 if(result.rate_window_ms<result.timeout_ms)throw Error('The rate window must be at least the response timeout.');
 if(result.max_pending>result.max_requests)throw Error('Pending reads must not exceed requests per window.');
 const age=value.pending_max_age_ms;
 result.pending_max_age_ms=null;
 if(age!==undefined&&age!==null&&age!==''){if(!((typeof age==='string'&&/^[1-9]\d*$/.test(age))||Number.isSafeInteger(age))||Number(age)<1||Number(age)>60000)throw Error('Pending read maximum age must be 1-60000 ms or blank.');if(result.rate_window_ms<1000)throw Error('Pending reads require a rate window of at least 1000 ms.');result.pending_max_age_ms=Number(age);}
 return result;
}
export function recoveryPolicyPayload(revision,value){if(!revisionOK(revision))throw Error('Reload the saved recovery policy revision.');return {expected_revision:revision,policy:recoveryPolicyFields(value)};}
export function validateRecoveryPolicyResponse(value,connection){
 if(value?.configured===false&&value.policy===null&&value.application==='unconfigured')return value;
 const p=value?.policy;
 if(value?.configured!==true||value.application!=='saved_for_original_fix_reads'||p?.connection_id!==connection||!revisionOK(p?.revision)||p.revision==='0'||typeof p.created_at!=='string'||!Number.isFinite(Date.parse(p.created_at)))throw Error('Invalid saved recovery policy.');
 for(const key of Object.keys(emptyRecoveryPolicy()))if(key!=='pending_max_age_ms'&&!Number.isSafeInteger(p[key]))throw Error('Invalid recovery policy limit.');
 if(p.pending_max_age_ms!=null&&!Number.isSafeInteger(p.pending_max_age_ms))throw Error('Invalid pending read maximum age.');
 recoveryPolicyFields(p);return value;
}
export const recoveryPolicyError=code=>({CONFIGURATION_CONFLICT:'The saved recovery revision changed. Reload and review before saving.',LP_PERMISSION_DENIED:'Your current LP grant does not allow this connection or action.',FORBIDDEN:'This account is not authorized for the recovery policy.',INVALID_INPUT:'Check the explicit recovery limits and revision.',LP_INVALID_REQUEST:'Check the explicit recovery limits and revision.',LP_CONFIGURATION_UNAVAILABLE:'Recovery configuration is unavailable.'}[code]||'Recovery policy is unavailable.');
export function createLPRecoveryPolicyAPI(request=defaultRequest){
 const call=async(path,method='GET',payload)=>{let response;try{response=await request(path,{method,cache:'no-store',...(payload?{headers:{'content-type':'application/json'},body:JSON.stringify(payload)}:{})});}catch{throw Error('Recovery policy request failed.');}let data;try{data=await response.json();}catch{throw Error('Invalid recovery policy response.');}if(!response.ok){const e=Error(recoveryPolicyError(data?.error_code));e.code=data?.error_code;throw e;}return data;};
 return {connections:async()=>{const v=await call('/api/v1/manager/lp-connections');if(!Array.isArray(v.connections))throw Error('Connections are unavailable.');return v.connections.map(row=>({id:row.config.id,name:row.config.name})).filter(row=>idOK(row.id));},get:async connection=>{if(!idOK(connection))throw Error('Select a saved connection.');return validateRecoveryPolicyResponse(await call(base+encodeURIComponent(connection)),connection);},save:async(connection,revision,draft)=>{if(!idOK(connection))throw Error('Select a saved connection.');const payload=recoveryPolicyPayload(revision,draft);const v=validateRecoveryPolicyResponse(await call(base+encodeURIComponent(connection),'PUT',payload),connection);if(!v.configured)throw Error('Saved recovery policy was not confirmed.');return v;}};
}
export const lpRecoveryPolicy=createLPRecoveryPolicyAPI();
