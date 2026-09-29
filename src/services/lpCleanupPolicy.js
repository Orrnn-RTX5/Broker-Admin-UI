import {api} from '../lib/api.js';
const defaultRequest=async(path,options)=>{try{const r=await api.request({url:path,method:options.method,data:options.body?JSON.parse(options.body):undefined,_noRetry:true});return {ok:true,json:async()=>r.data};}catch(e){if(!e.response)throw e;return {ok:false,json:async()=>e.response.data};}};

const base='/api/v1/manager/lp-routing/cleanup-policies/';
const idOK=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value);
const revisionOK=value=>typeof value==='string'&&/^(0|[1-9]\d*)$/.test(value)&&BigInt(value)<9223372036854775807n;
export const emptyCleanupPolicy=()=>({max_attempts:'',recovery_window_ms:'',max_quote_age_ms:'',max_deviation_bps:''});
export function cleanupPolicyFields(value,connection){
 if(!idOK(connection)||value.connection_id!==connection)throw Error('Select the matching saved connection.');
 const result={connection_id:connection};
 for(const [key,max] of [['max_attempts',10],['recovery_window_ms',86400000],['max_quote_age_ms',60000]]){const v=value[key];if(!((typeof v==='string'&&/^[1-9]\d*$/.test(v))||Number.isSafeInteger(v))||Number(v)<1||Number(v)>max)throw Error('Enter explicit cleanup limits within the displayed bounds.');result[key]=Number(v);}
 const gap=value.max_deviation_bps;if(typeof gap!=='string'||!/^(0|[1-9]\d*)(\.\d{1,18})?$/.test(gap)||gap.length>40)throw Error('Enter an exact deviation from 0 to 10000 bps.');const units=BigInt(gap.split('.')[0])*10n**18n+BigInt((gap.split('.')[1]||'').padEnd(18,'0'));if(units>10000n*10n**18n)throw Error('Deviation must not exceed 10000 bps.');result.max_deviation_bps=gap;return result;
}
export function cleanupPolicyPayload(connection,revision,value){if(!revisionOK(revision))throw Error('Reload the saved cleanup policy revision.');return {expected_revision:revision,policy:cleanupPolicyFields({...value,connection_id:connection},connection)};}
export function validateCleanupPolicyResponse(value,connection){
 if(value?.configured===false&&value.policy===null&&value.application==='unconfigured')return value;
 if(value?.configured!==true||value.application!=='pinned_on_new_external_admission'||!revisionOK(value.policy?.revision)||value.policy.revision==='0')throw Error('Invalid saved cleanup policy.');
 const p=value.policy;for(const key of ['max_attempts','recovery_window_ms','max_quote_age_ms'])if(!Number.isSafeInteger(p[key]))throw Error('Invalid cleanup policy limit.');cleanupPolicyFields(p,connection);return value;
}
export const cleanupPolicyError=code=>({CONFIGURATION_CONFLICT:'The saved revision changed. Reload and review before saving.',CONFIGURATION_IN_USE:'Active orders, positions or unresolved exposure lock this cleanup policy. Reload after those obligations are resolved.',LP_PERMISSION_DENIED:'Your current LP grant does not allow this connection or action.',FORBIDDEN:'This account is not authorized for the cleanup policy.',INVALID_INPUT:'Check the explicit cleanup limits and revision.',LP_INVALID_REQUEST:'Check the explicit cleanup limits and revision.',LP_CONFIGURATION_UNAVAILABLE:'Cleanup configuration is unavailable.',CLEANUP_POLICY_UNCONFIGURED:'Cleanup limits must be configured before new external admission.'}[code]||'Cleanup policy is unavailable.');
export function createLPCleanupPolicyAPI(request=defaultRequest){
 const call=async(path,method='GET',payload)=>{let response;try{response=await request(path,{method,cache:'no-store',...(payload?{headers:{'content-type':'application/json'},body:JSON.stringify(payload)}:{})});}catch{throw Error('Cleanup policy request failed.');}let data;try{data=await response.json();}catch{throw Error('Invalid cleanup policy response.');}if(!response.ok){const e=Error(cleanupPolicyError(data?.error_code));e.code=data?.error_code;throw e;}return data;};
 return {connections:async()=>{const v=await call('/api/v1/manager/lp-connections');if(!Array.isArray(v.connections))throw Error('Connections are unavailable.');return v.connections.map(row=>({id:row.config.id,name:row.config.name})).filter(row=>idOK(row.id));},get:async connection=>{if(!idOK(connection))throw Error('Select a saved connection.');return validateCleanupPolicyResponse(await call(base+encodeURIComponent(connection)),connection);},save:async(connection,revision,draft)=>{const payload=cleanupPolicyPayload(connection,revision,draft);const v=validateCleanupPolicyResponse(await call(base+encodeURIComponent(connection),'PUT',payload),connection);if(!v.configured)throw Error('Saved cleanup policy was not confirmed.');return v;}};
}
export const lpCleanupPolicy=createLPCleanupPolicyAPI();
