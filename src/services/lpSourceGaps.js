import {api} from '../lib/api.js';

// Source-gap status and operator hold release (lane A3, backend B5).
// Policy is fixed to `hold` by user decision: a held pending order or protection
// stays held until an operator releases it. The UI never edits the policy.
const defaultRequest=async(path,options)=>{try{const r=await api.request({url:path,method:options.method,data:options.body?JSON.parse(options.body):undefined,_noRetry:true});return {ok:true,json:async()=>r.data};}catch(e){if(!e.response)throw e;return {ok:false,json:async()=>e.response.data};}};

const base='/api/v1/manager/lp-runtime/source-gaps';
const int64Max=9223372036854775807n;
const decimal=(value,allowZero)=>typeof value==='string'&&(allowZero?/^(0|[1-9]\d{0,18})$/:/^[1-9]\d{0,18}$/).test(value)&&BigInt(value)<=int64Max;
const count=value=>Number.isSafeInteger(value)&&value>=0;
const text=(value,max)=>typeof value==='string'&&value.length>0&&value.length<=max&&value.trim()===value;
const time=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
export const SOURCE_GAP_REASONS=Object.freeze({provider_session_lost:'Provider session lost',subscription_refresh:'Subscription refresh'});
export const TYPED_OFF_MESSAGE='Typed source gaps are off (gaps fault the partition and use audited recovery).';
export const RELEASE_CONFIRM_TEXT='Evaluation resumes from the next fresh quote after release. Prices during the gap are not replayed; a level crossed only during the gap will not fill.';
const invalid=()=>Error('Invalid source continuity status.');

export const holdKey=hold=>`${hold.entity_kind}:${hold.ticket_text}:${hold.order_version}`;

function validateHold(hold){
 if(!hold||typeof hold!=='object'||!['pending','protection'].includes(hold.entity_kind)||!decimal(hold.ticket_text,false)||!decimal(hold.order_version,true)||!text(hold.account_login,64)||!text(hold.symbol,64)||!text(hold.feed,128)||!count(hold.partition)||!Array.isArray(hold.gap_ids)||hold.gap_ids.length<1||hold.gap_ids.some(id=>!text(id,128))||!Object.hasOwn(SOURCE_GAP_REASONS,hold.gap_reason)||!time(hold.opened_at)||typeof hold.resumed!=='boolean'||typeof hold.first_fresh_seen!=='boolean')throw invalid();
 // Per the user decision only `hold` is valid; anything else fails closed.
 if(hold.policy!=='hold')throw invalid();
 // A first fresh quote can only follow a resume.
 if(hold.first_fresh_seen&&!hold.resumed)throw invalid();
 if(hold.connection_id!=null&&!text(hold.connection_id,128))throw invalid();
}

export function validateSourceGapStatus(value){
 if(!value||typeof value!=='object'||typeof value.typed!=='boolean')throw invalid();
 if(!value.typed)return {typed:false,available:false,message:TYPED_OFF_MESSAGE,holds:[]};
 if(typeof value.available!=='boolean')throw invalid();
 if(!value.available)return {typed:true,available:false,message:'Source continuity status is unavailable. Treat named triggers as degraded until it returns.',holds:[]};
 if(value.policy_pending!=='hold'||value.policy_protection!=='hold')throw invalid();
 if(typeof value.degraded!=='boolean'||!['unresumed_gaps','open_symbol_gaps','held_business','recorded_gaps'].every(key=>count(value[key]))||!time(value.observed_at)||!Array.isArray(value.holds))throw invalid();
 if(value.tenant_id!=null&&!text(value.tenant_id,256))throw invalid();
 const seen=new Set();
 for(const hold of value.holds){validateHold(hold);const key=holdKey(hold);if(seen.has(key))throw invalid();seen.add(key);}
 return value;
}

// releaseState explains, per activation, whether the server can accept a release.
// The server enforces the same rule; this only avoids offering a refused action.
export function releaseState(hold){
 if(!hold.resumed)return {allowed:false,reason:'Waiting for the source gap to resume.'};
 if(!hold.first_fresh_seen)return {allowed:false,reason:'Waiting for the first fresh post-gap quote.'};
 return {allowed:true,reason:''};
}

const utf8Length=value=>new TextEncoder().encode(value).length;
export function sourceGapReleasePayload({entity_kind,ticket_text,order_version,reference}){
 if(!['pending','protection'].includes(entity_kind))throw Error('Select a held pending order or protection.');
 if(!decimal(ticket_text,false)||!decimal(order_version,true))throw Error('Reload the held item before releasing it.');
 const ref=typeof reference==='string'?reference.trim():'';
 const size=utf8Length(ref);
 if(size<8||size>256)throw Error('Enter an operator reference of 8 to 256 characters.');
 // The ticket and version stay decimal strings end to end (tickets exceed 2^53).
 return {entity_kind,ticket:ticket_text,order_version,reference:ref};
}

export function validateSourceGapReleaseResponse(value){
 if(!value||!Number.isSafeInteger(value.released)||value.released<1||!count(value.partition)||!decimal(value.release_stream_sequence,false))throw Error('Release was not confirmed. Refresh status before retrying.');
 return value;
}

export const sourceGapError=code=>({
 SOURCE_GAP_HOLD_NOT_FOUND:'No unreleased hold matches this item. It may already be released or superseded; refresh status.',
 SOURCE_GAP_NOT_CLOSED:'The gap has not resumed or no fresh post-gap quote has arrived yet. Release is refused.',
 TRIGGER_RECOVERY_REQUIRED:'Partition requires audited recovery; release is refused.',
 SOURCE_GAP_RELEASE_UNAVAILABLE:'Source gap release is unavailable (typed source gaps are off or the service is not ready).',
 LP_FORBIDDEN:'This account is not authorized to release source gap holds.',
 FORBIDDEN:'This account is not authorized to release source gap holds.',
 INVALID_REQUEST:'Check the held item and the operator reference.',
 INVALID_INPUT:'Check the held item and the operator reference.',
}[code]||'Source continuity is unavailable.');

export function createLPSourceGapsAPI(request=defaultRequest){
 const call=async(path,method='GET',payload)=>{let response;try{response=await request(path,{method,cache:'no-store',...(payload?{headers:{'content-type':'application/json'},body:JSON.stringify(payload)}:{})});}catch{throw Error('Source continuity request failed.');}let data;try{data=await response.json();}catch{throw Error('Invalid source continuity response.');}if(!response.ok){const code=data?.error_code??data?.error;const e=Error(sourceGapError(code));e.code=typeof code==='string'?code:undefined;throw e;}return data;};
 return {
  status:async()=>validateSourceGapStatus(await call(base)),
  release:async hold=>validateSourceGapReleaseResponse(await call(base+'/release','POST',sourceGapReleasePayload(hold))),
 };
}
export const lpSourceGaps=createLPSourceGapsAPI();

// namedFeedID mirrors pkg/triggerticks.NamedFeedID so holds can be filtered to a
// saved connection when the status carries tenant_id. Returns null when unknown.
export async function namedFeedID(tenant,connection,revision){
 if(!text(tenant,256)||!text(connection,256)||!Number.isSafeInteger(revision)||revision<1||!globalThis.crypto?.subtle)return null;
 const rev=String(revision);
 const material=`${tenant.length}:${tenant}${connection.length}:${connection}${rev.length}:${rev}`;
 // Go uses byte length; reject non-ASCII identities rather than risk a mismatch.
 if(utf8Length(material)!==material.length)return null;
 const digest=new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(material)));
 return 'namedlp.v1.'+Array.from(digest,b=>b.toString(16).padStart(2,'0')).join('');
}
