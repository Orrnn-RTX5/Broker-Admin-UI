import { api } from '../lib/api.js';
const defaultRequest=async(path,options)=>{try{const r=await api.request({url:path,method:options.method,data:options.body?JSON.parse(options.body):undefined,_noRetry:true});return {ok:true,json:async()=>r.data};}catch(error){if(!error.response)throw error;return {ok:false,json:async()=>error.response.data};}};

const base='/api/v1/manager/lp-feeds';
const id=value=>{if(!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value))throw new Error('Select a named feed.');return encodeURIComponent(value);};
const account=value=>{if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value))throw new Error('Enter the account UUID.');return value.toLowerCase();};
const group=value=>{if(typeof value!=='string'||!value.trim()||value!==value.trim()||value.length>100||/[\r\n\0]/.test(value))throw new Error('Enter the saved group name.');return encodeURIComponent(value);};
export function feedSelectionPayload(revision,connectionID){
 if(typeof revision!=='string'||!/^(0|[1-9][0-9]*)$/.test(revision)||BigInt(revision)>=9223372036854775807n)throw new Error('Reload the account selection before saving.');
 id(connectionID);return {expected_revision:revision,connection_id:connectionID};
}
export function matchingFeedSnapshot(source,catalog,ticks){
 const timestamp=value=>Number.isSafeInteger(value)&&value>0&&value<=8640000000000000;
 const decimal=value=>typeof value==='string'&&value.length<=512&&/^\d+(\.\d+)?$/.test(value);
 if(!timestamp(ticks?.published_at_ms)||!Object.values(ticks?.ticks||{}).every(tick=>timestamp(tick?.received_at_ms)))throw new Error('Feed observation timestamp is unavailable.');
 if(!source||catalog?.source_id!==source||ticks?.source_id!==source||!catalog.connection_revision||catalog.connection_revision!==ticks.connection_revision||!Array.isArray(catalog.catalog)||!ticks.ticks)throw new Error('Feed identity or revision changed. Refresh this source.');
 const instruments=new Map(catalog.catalog.map(item=>[item.symbol,item.provider_instrument_id]));
 for(const [symbol,tick]of Object.entries(ticks.ticks))if(tick.symbol!==symbol||!instruments.has(symbol)||instruments.get(symbol)!==tick.provider_instrument_id||!['exact_fix','float64_observation'].includes(tick.precision)||!decimal(tick.bid)||!decimal(tick.ask)||!(tick.received_at_ms>0))throw new Error('Feed observation is unavailable.');
 return {catalog:catalog.catalog,ticks:ticks.ticks,revision:catalog.connection_revision,publishedAt:ticks.published_at_ms};
}
export function createLPFeeds(request=defaultRequest){
 const call=async(path,method='GET',body)=>{const r=await request(base+path,{method,headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const value=await r.json();if(!r.ok){const messages={LP_PERMISSION_DENIED:'Your LP grant does not allow this source or account.',CONFIGURATION_CONFLICT:'The source selection changed. Reload the account before saving.',CONFIGURATION_IN_USE:'This account has positions, pending orders, or unresolved execution. Its source cannot change.',LP_ACCOUNT_FEED_NOT_FOUND:'The active account is unavailable.',LP_FEED_SELECTION_INVALID:'Select an enabled quote source.',LP_FEED_UNAVAILABLE:'The named feed is unavailable. No other source has been substituted.'};throw new Error(messages[value?.error_code]||'The named feed request failed.');}return value;};
 return {list:()=>call(''),catalog:source=>call('/'+id(source)+'/catalog'),ticks:source=>call('/'+id(source)+'/ticks'),account:uuid=>call('/accounts/'+account(uuid)),group:name=>call('/groups/'+group(name)),saveGroup:(name,revision,source)=>call('/groups/'+group(name),'PUT',feedSelectionPayload(revision,source)),inheritAccount:()=>{throw new Error('Account quote sources are controlled by the group.');},saveAccount:()=>{throw new Error('Account quote sources are controlled by the group.');}};
}
export const lpFeeds=createLPFeeds();
