import {api} from '../lib/api.js';

// Exact pending Modify admission limit (lane A4, backend B6). One tenant-wide
// value with an expected-revision CAS, like the cleanup and recovery policies.
const defaultRequest=async(path,options)=>{try{const r=await api.request({url:path,method:options.method,data:options.body?JSON.parse(options.body):undefined,_noRetry:true});return {ok:true,json:async()=>r.data};}catch(e){if(!e.response)throw e;return {ok:false,json:async()=>e.response.data};}};

const path='/api/v1/manager/lp-routing/exact-pending-modify-admission';
export const MODIFY_ADMISSION_MIN=1;
export const MODIFY_ADMISSION_MAX=128;
export const MODIFY_ADMISSION_DEFAULT=3;
const revisionOK=value=>typeof value==='string'&&/^(0|[1-9]\d{0,18})$/.test(value)&&BigInt(value)<9223372036854775807n;
const limitOK=value=>Number.isSafeInteger(value)&&value>=MODIFY_ADMISSION_MIN&&value<=MODIFY_ADMISSION_MAX;

export function modifyAdmissionLimit(value){
 const ok=(typeof value==='string'&&/^[1-9]\d{0,2}$/.test(value))||Number.isSafeInteger(value);
 const n=Number(value);
 if(!ok||!limitOK(n))throw Error(`Enter a whole number from ${MODIFY_ADMISSION_MIN} to ${MODIFY_ADMISSION_MAX}.`);
 return n;
}

export function modifyAdmissionPayload(revision,limit){
 if(!revisionOK(revision))throw Error('Reload the saved admission revision.');
 return {expected_revision:revision,max_unsuccessful_modify_per_ticket:modifyAdmissionLimit(limit)};
}

export function validateModifyAdmissionResponse(value){
 if(!value||typeof value.configured!=='boolean'||!revisionOK(value.revision)||!limitOK(value.max_unsuccessful_modify_per_ticket)||value.default!==MODIFY_ADMISSION_DEFAULT||value.min!==MODIFY_ADMISSION_MIN||value.max!==MODIFY_ADMISSION_MAX||value.application!=='new_modify_admissions_only')throw Error('Invalid Modify admission settings.');
 // Unconfigured is revision '0'; a saved value always has a positive revision.
 if(value.configured!==(value.revision!=='0'))throw Error('Invalid Modify admission settings.');
 return value;
}

export const modifyAdmissionError=code=>({
 CONFIGURATION_CONFLICT:'The saved admission revision changed. Reload and review before saving.',
 EXACT_PENDING_MODIFY_POLICY_UNAVAILABLE:'Migration 326 or its storage is unavailable; admission fails closed.',
 INVALID_INPUT:`Enter a whole number from ${MODIFY_ADMISSION_MIN} to ${MODIFY_ADMISSION_MAX} and reload the revision.`,
 INVALID_REQUEST:`Enter a whole number from ${MODIFY_ADMISSION_MIN} to ${MODIFY_ADMISSION_MAX} and reload the revision.`,
 FORBIDDEN:'This account is not authorized for Modify admission settings.',
 LP_FORBIDDEN:'This account is not authorized for Modify admission settings.',
}[code]||'Modify admission settings are unavailable.');

export function createLPExactPendingModifyAdmissionAPI(request=defaultRequest){
 const call=async(method='GET',payload)=>{let response;try{response=await request(path,{method,cache:'no-store',...(payload?{headers:{'content-type':'application/json'},body:JSON.stringify(payload)}:{})});}catch{throw Error('Modify admission request failed.');}let data;try{data=await response.json();}catch{throw Error('Invalid Modify admission response.');}if(!response.ok){const code=data?.error_code??data?.error;const e=Error(modifyAdmissionError(code));e.code=typeof code==='string'?code:undefined;throw e;}return data;};
 return {
  get:async()=>validateModifyAdmissionResponse(await call()),
  save:async(revision,limit)=>{
   const payload=modifyAdmissionPayload(revision,limit);
   const v=validateModifyAdmissionResponse(await call('PUT',payload));
   if(!v.configured||BigInt(v.revision)<=BigInt(revision)||v.max_unsuccessful_modify_per_ticket!==payload.max_unsuccessful_modify_per_ticket)throw Error('Saved Modify admission limit was not confirmed. Reload before another save.');
   return v;
  },
 };
}
export const lpExactPendingModifyAdmission=createLPExactPendingModifyAdmissionAPI();
