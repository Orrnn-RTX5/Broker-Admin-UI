import {api} from '../lib/api.js';
import {AUTO_BOOTSTRAP_RUN_TIMEOUT_MS,readAutoBootstrapRefusal} from './autoBootstrap.js';
import {baselineLogin} from './calculationBaseline.js';

const base='/api/v1/manager/calculation-baseline/auto-bootstrap/';
async function call(request){
 try {const response=await api.request({...request,_noRetry:true});return response.data;}
 catch(error){if(error.response)throw new Error(readAutoBootstrapRefusal(error.response));throw error;}
}
export const getAutoBootstrap=login=>call({url:base+baselineLogin(login),method:'GET'});
export const putAutoBootstrap=(login,body)=>call({url:base+baselineLogin(login),method:'PUT',data:body});
// Synchronous on the server (up to 60 s): the client waits 75 s and never retries.
export async function runAutoBootstrap(login){
 try {return await call({url:base+'run/'+baselineLogin(login),method:'POST',data:{},timeout:AUTO_BOOTSTRAP_RUN_TIMEOUT_MS});}
 catch(error){
  if(!error.response&&(error.code==='ECONNABORTED'||error.code==='ETIMEDOUT'))throw new Error(`The bootstrap run did not answer within ${AUTO_BOOTSTRAP_RUN_TIMEOUT_MS/1000} s. Check the status before running again.`);
  throw error;
 }
}
export const getAutoBootstrapStatus=login=>call({url:base+'status/'+baselineLogin(login),method:'GET'});
