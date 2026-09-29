import {readExactDemoSizing,exactDemoCoverage} from './lpExactDemoSizing.js';
import {copyLPDemoMarker} from './lpDemoMarker.js';

const decimal=/^(0|[1-9][0-9]*)(\.[0-9]{1,18})?$/;
const clean=value=>value.includes('.')?value.replace(/0+$/,'').replace(/\.$/,''):value;
const numberText=value=>{
 const [coefficient,exponent]=String(value).split('e');if(exponent===undefined)return clean(coefficient);
 const parts=coefficient.split('.'),digits=parts.join(''),point=parts[0].length+Number(exponent);
 return clean(point<=0?'0.'+'0'.repeat(-point)+digits:point>=digits.length?digits+'0'.repeat(point-digits.length):digits.slice(0,point)+'.'+digits.slice(point));
};
export function demoMarketDraft(input){
 const login=Number(input.account_login),volume=String(input.volume??'').trim(),amount=Number(volume),symbol=String(input.symbol??'').trim().toUpperCase();
 if(!Number.isSafeInteger(login)||login<=0)throw new Error('Enter the demo account login.');
 if(!decimal.test(volume)||volume.length>58||!Number.isFinite(amount)||amount<=0||numberText(amount)!==clean(volume))throw new Error('Enter a positive volume that the market order interface can represent exactly.');
 if(!symbol||symbol.length>64||/[\s\x00-\x1f]/.test(symbol))throw new Error('Enter a configured symbol.');
 if(!['buy','sell'].includes(input.side)||!['FOK','IOC'].includes(input.execution_policy))throw new Error('Choose a side and supported execution policy.');
 return {account_login:login,symbol,side:input.side,volume:clean(volume),execution_policy:input.execution_policy};
}
const revision=value=>typeof value==='string'&&/^(0|[1-9][0-9]*)$/.test(value);
const qty=value=>typeof value==='string'&&decimal.test(value)&&value.length<=58;
export function readDemoMarketPreview(value,draft){
 const normalized=demoMarketDraft(draft);
 if(!value||typeof value.ready!=='boolean')throw new Error('Demo preview is unavailable.');
 if(!value.ready)return {ready:false,reason:typeof value.reason==='string'?value.reason:'LP_DEMO_PREVIEW_UNAVAILABLE'};
 if(JSON.stringify(demoMarketDraft(value.draft))!==JSON.stringify(normalized)||value.draft_fingerprint!==value.scope?.draft_fingerprint)throw new Error('Demo preview does not match this order.');
 const marker=copyLPDemoMarker(value.marker);
 if(JSON.stringify(marker.scope)!==JSON.stringify(copyLPDemoMarker({...marker,scope:value.scope}).scope)||marker.valid_until!==value.valid_until)throw new Error('Demo preview identity changed.');
 if(!Number.isFinite(Date.parse(value.evaluated_at))||!Number.isFinite(Date.parse(value.valid_until))||Date.parse(value.valid_until)<=Date.parse(value.evaluated_at))throw new Error('Demo preview has no valid expiry.');
 const coverage=value.coverage;
 if(coverage?.mode!=='volume'||!['customer_lots','lp_requested_lots','internal_lots','broker_excess_lots'].every(key=>qty(coverage[key]))||!/[1-9]/.test(coverage.lp_requested_lots))throw new Error('Verified demo allocation is unavailable.');
 if(!Object.entries(marker.scope).filter(([key])=>key.endsWith('revision')||key==='rule_version').every(([,v])=>revision(v)))throw new Error('Demo preview revisions are unavailable.');
 let sizing;
 if(value.exact_demo_sizing!==undefined&&value.exact_demo_sizing!==null){
 sizing=readExactDemoSizing(value.exact_demo_sizing,{account_id:marker.scope.account_id,account_login:String(normalized.account_login),connection_id:marker.scope.connection_id,connection_revision:marker.scope.connection_revision,symbol:normalized.symbol,customer_lots:normalized.volume},Date.parse(value.evaluated_at));
 const expected=exactDemoCoverage(sizing);
 if(['customer_lots','lp_requested_lots','internal_lots','broker_excess_lots'].some(k=>coverage[k]!==expected[k])||Date.parse(value.valid_until)>Date.parse(sizing.opening_valid_until))throw Error('Exact demo preview cannot round, resize or create exposure beyond its approved fixed or hybrid split.');
 }
 return {ready:true,...(sizing?{exact_demo_sizing:sizing}:{}),draft:normalized,scope:marker.scope,marker,evaluated_at:value.evaluated_at,valid_until:value.valid_until,coverage:{...coverage}};
}
export const demoPreviewCurrent=(preview,now=Date.now())=>preview?.ready===true&&Number.isFinite(now)&&Date.parse(preview.valid_until)>now;
export function demoMarketCommand(preview,now=Date.now()){
 if(!demoPreviewCurrent(preview,now))throw new Error('Preview expired. Review a new preview before submitting.');
 if(preview.exact_demo_sizing)readExactDemoSizing(preview.exact_demo_sizing,{account_id:preview.scope.account_id,account_login:String(preview.draft.account_login),connection_id:preview.scope.connection_id,connection_revision:preview.scope.connection_revision,symbol:preview.draft.symbol,customer_lots:preview.draft.volume},now);
 const draft=demoMarketDraft(preview.draft);
 return {...draft,type:'market',volume:Number(draft.volume),lp_demo_test:copyLPDemoMarker(preview.marker)};
}
export function demoMarketError(code){
 return ({LP_DEMO_FORBIDDEN:'Demo trading is not permitted for this account and route.',LP_DEMO_SCOPE_CHANGED:'The selected route changed. Review a new preview.',LP_DEMO_PREVIEW_STALE:'The preview changed or expired. Review it again.',LP_DEMO_MODE_UNSUPPORTED:'This demo workflow requires volume coverage.',LP_DEMO_AUTHORITY_BUSY:'Permissions are changing. Check the original order status before retrying.',LP_DEMO_PREVIEW_UNAVAILABLE:'Demo preview is unavailable. Check connection readiness and verified symbol limits.'})[code]||'Demo preview is unavailable for this account, symbol and route.';
}
