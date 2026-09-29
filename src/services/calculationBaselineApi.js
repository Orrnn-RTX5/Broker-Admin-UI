import {api} from '../lib/api.js';
import {readCalculationRefusal} from './calculationBaseline.js';
const base='/api/v1/manager/calculation-baseline/';
const reads=new Set(['status','sources','cutover/status']);
async function call(action,login,data,query=''){
 try {const response=await api.request({url:base+action+'/'+login+query,method:reads.has(action)?'GET':'POST',...(data?{data}:{}),_noRetry:true});return response.data;}
 catch(error){if(error.response)throw new Error(readCalculationRefusal(error.response));throw error;}
}
export const previewCalculationBaseline=(login,draft)=>call('preview',login,{draft});
export const activateCalculationBaseline=(login,draft,fingerprint)=>call('activate',login,{draft,fingerprint,acknowledge_broker_wide:true,acknowledge_settings_review:true});
export const calculationBaselineStatus=(login,fingerprint)=>call('status',login,null,'?fingerprint='+encodeURIComponent(fingerprint));
export const calculationBaselineSources=login=>call('sources',login);
// Separate additive cutover under the active policy; never retried automatically.
export const previewCalculationCutover=(login,cutover)=>call('cutover/preview',login,{cutover});
export const applyCalculationCutover=(login,cutover,fingerprint)=>call('cutover/apply',login,{cutover,fingerprint,acknowledge_cutover_scope:true});
export const calculationCutoverStatus=(login,fingerprint)=>call('cutover/status',login,null,'?fingerprint='+encodeURIComponent(fingerprint));
