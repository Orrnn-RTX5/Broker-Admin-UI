import {api} from '../lib/api.js';
const defaultRequest=async(path,options)=>{try{const r=await api.request({url:path,method:options.method,data:options.body?JSON.parse(options.body):undefined,_noRetry:true});return {ok:true,json:async()=>r.data};}catch(e){if(!e.response)throw e;return {ok:false,json:async()=>e.response.data};}};

const base='/api/v1/manager/lp-routing/coverage-preview/';
const idOK=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(v);
const decimal=v=>typeof v==='string'&&/^(0|[1-9]\d{0,19})(\.\d{1,18})?$/.test(v);
const auditDecimal=v=>typeof v==='string'&&/^(0|[1-9]\d{0,39})(\.\d{1,38})?$/.test(v);
const units=v=>BigInt(v.split('.')[0])*10n**18n+BigInt((v.split('.')[1]||'').padEnd(18,'0'));
const canonical=v=>v.includes('.')?v.replace(/0+$/,'').replace(/\.$/,''):v;
const revision=v=>typeof v==='string'&&/^[1-9]\d{0,18}$/.test(v)&&BigInt(v)<=9223372036854775807n;
const text=v=>typeof v==='string'&&v.trim()===v&&v.length>0&&v.length<=512&&!/[\r\n\0]/.test(v);
const date=v=>typeof v==='string'&&v.length<=40&&Number.isFinite(Date.parse(v));
export function coveragePreviewInput(symbol,customerLots,draft){
 if(typeof symbol!=='string'||!symbol||symbol.trim()!==symbol||symbol.length>128||/[/\\?#\r\n\0]/.test(symbol)||!decimal(customerLots)||units(customerLots)===0n)throw Error('Choose a saved instrument and enter exact positive customer lots.');
 let policy;
 if(draft.mode==='volume'&&decimal(draft.volume_percent))policy={mode:'volume',volume_percent:draft.volume_percent};
 else if(draft.mode==='whole_orders'&&decimal(draft.selection_percent)&&units(draft.selection_percent)<=100n*10n**18n&&decimal(draft.selected_coverage_percent)&&units(draft.selected_coverage_percent)>0n)policy={mode:'whole_orders',selection_percent:draft.selection_percent,selected_coverage_percent:draft.selected_coverage_percent};
 else throw Error('Complete the draft coverage percentages before previewing.');
 return {symbol,customer_lots:customerLots,policy};
}
export function coveragePreviewWithinGrant(draft,maximum){
 const value=draft.mode==='volume'?draft.volume_percent:draft.selected_coverage_percent;
 return decimal(value)&&decimal(maximum)&&units(value)<=units(maximum);
}
export function validateCoveragePreview(v,connection,input){
 if(v?.kind!=='coverage_preview'||v.admission!==false||v.connection_id!==connection||typeof v.connection_enabled!=='boolean'||v.symbol!==input.symbol||v.customer_lots!==canonical(input.customer_lots)||v.mode!==input.policy.mode||!revision(v.connection_revision)||!revision(v.evidence_revision)||!text(v.feed_id)||!text(v.evidence_id)||!['provider_spec','provider_demo','simulator'].includes(v.source)||![v.verified_at,v.valid_until,v.evaluated_at].every(date)||Date.parse(v.verified_at)>Date.parse(v.evaluated_at)||Date.parse(v.valid_until)<=Date.parse(v.evaluated_at))throw Error('Preview metadata is unavailable or does not match this draft.');
 const g=v.grid;if(g?.verified!==true||!text(g.evidence_id)||!['min_lots','max_lots','step_lots','grid_origin_lots','units_per_lot'].every(k=>decimal(g[k]))||['min_lots','max_lots','step_lots','units_per_lot'].some(k=>units(g[k])===0n)||units(g.max_lots)<units(g.min_lots))throw Error('The preview requires verified saved lot limits.');
 const names=v.mode==='volume'?['volume']:['selected','unselected'];if(!Array.isArray(v.scenarios)||v.scenarios.length!==names.length)throw Error('Preview scenarios are unavailable.');
 let probability=0n;
 for(const [index,s]of v.scenarios.entries()){
  const a=s.allocation;if(s.name!==names[index]||!decimal(s.probability_percent)||units(s.probability_percent)>100n*10n**18n||!auditDecimal(s.requested_lp_lots)||!auditDecimal(s.rounding_lots)||!a||!['customer_lots','lp_customer_lots','lp_requested_lots','b_book_lots','excess_lots','units_per_lot','target_wire_qty'].every(k=>decimal(a[k]))||a.customer_lots!==v.customer_lots)throw Error('Exact preview quantities are unavailable.');
  probability+=units(s.probability_percent);
 }
 if(probability!==100n*10n**18n||(v.mode==='whole_orders'&&units(v.scenarios[0].probability_percent)!==units(input.policy.selection_percent)))throw Error('Preview probabilities do not match this draft.');
 return v;
}
const errors={LP_PERMISSION_DENIED:'Your configuration grant does not permit this connection or coverage percentage.',FORBIDDEN:'This preview is not authorized.',ROUTING_EVIDENCE_INVALID:'Saved instrument evidence is stale or does not match this connection. Refresh the evidence before previewing.',ROUTING_NOT_FOUND:'This saved connection or instrument is unavailable.',INVALID_INPUT:'The requested preview cannot be represented on the verified lot grid or exceeds its limits.',LP_INVALID_REQUEST:'Check the instrument, exact lots and draft percentages.',LP_CONFIGURATION_UNAVAILABLE:'Saved preview metadata is unavailable.'};
export function createLPCoveragePreview(request=defaultRequest){return {preview:async(connection,input)=>{
 if(!idOK(connection))throw Error('Select a saved named connection.');
 const payload=coveragePreviewInput(input.symbol,input.customer_lots,input.policy);
 let response;try{response=await request(base+encodeURIComponent(connection),{method:'POST',cache:'no-store',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});}catch{throw Error('Coverage preview request failed.');}
 let value;try{value=await response.json();}catch{throw Error('Invalid coverage preview response.');}
 if(!response.ok){const error=Error(errors[value?.error_code]||'Coverage preview is unavailable.');error.code=value?.error_code;throw error;}
 return validateCoveragePreview(value,connection,payload);
}};}
export const lpCoveragePreview=createLPCoveragePreview();
