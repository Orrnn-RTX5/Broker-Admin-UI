import {api} from '../lib/api.js';
const request=async(path,signal)=>(await api.get(path,{signal,_noRetry:true})).data;
import {validateCustomerPendingPage} from './customerPendingRead.js';
export {nativePendingLabels} from './customerPendingRead.js';
export async function readCustomerPending(login,{signal}={}){if(!/^[1-9][0-9]*$/.test(String(login)))throw Error('Invalid account.');return validateCustomerPendingPage(await request('/api/v1/manager/accounts/'+encodeURIComponent(String(login))+'/native-pending',signal));}

