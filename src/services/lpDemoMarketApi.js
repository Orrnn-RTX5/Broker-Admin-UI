import {api} from '../lib/api.js';
import {demoMarketDraft,readDemoMarketPreview,demoMarketError} from './lpDemoMarket.js';
export async function previewDemoMarket(input){
 const draft=demoMarketDraft(input);
 try{const response=await api.request({url:'/api/v1/manager/lp-demo-market/preview/'+draft.account_login,method:'POST',data:draft,_noRetry:true});return readDemoMarketPreview(response.data,draft);}
 catch(error){if(error.response)throw new Error(demoMarketError(error.response.data?.error_code));throw error;}
}
