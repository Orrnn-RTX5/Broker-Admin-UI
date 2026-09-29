import {validateExactDemoEvidence,validateRetainedExactDemoEvidence} from './lpExactDemoSizing.js';
import { api } from '../lib/api.js';
const defaultRequest = async (path, options) => {
 try { const response = await api.request({url:path,method:options.method,data:options.body ? JSON.parse(options.body) : undefined,_noRetry:true}); return {ok:true,json:async()=>response.data}; }
 catch(error) { if (!error.response) throw error; return {ok:false,json:async()=>error.response.data}; }
};

const base = '/api/v1/manager/lp-routing';
const idPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
export const revisionOK = value => typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value) && BigInt(value) < 9223372036854775807n;
export const decimalOK = value => typeof value === 'string' && /^(0|[1-9][0-9]*)(\.[0-9]{1,18})?$/.test(value) && value.replace('.','').length <= 38;
const exactUnits = value => BigInt(value.split('.')[0]) * 10n**18n + BigInt((value.split('.')[1] || '').padEnd(18,'0'));
export const selectorValues = text => [...new Set(text.split(/[\n,]/).map(value => value.trim()).filter(Boolean))];
export const newExecutionSettings = () => ({default_policy:'FOK',markup_points:'0',dispatch_delay_ms:0,quote_max_age_ms:1000,max_adverse_gap_bps:'0'});
export const newRoutingRule = () => ({id:'',version:'0',enabled:false,connection_id:'',scope:{groups:{include:[],exclude:[]},accounts:{include:[],exclude:[]},symbols:{include:[],exclude:[]},min_lots:'0',max_lots:''},policy:{mode:'volume',volume_percent:'0'},execution:newExecutionSettings()});
const identity = role => ({connection_id:'',provider:'',environment:'',upstream_account:'',symbol:'',provider_symbol_id:'',symbol_mapping_version:'',pairing_id:'',role,verified:false});
export const newRoutingEvidence = () => ({verified_at:'',valid_until:'',connection_id:'',connection_revision:'',symbol:'',feed_id:'',revision:'0',source:'',evidence_id:'',capability_evidence_id:'',account_mode:'',effective_time_in_force:'',quote:identity('quote'),trade:identity('trade'),grid:{verified:false,evidence_id:'',min_lots:'',max_lots:'',step_lots:'',grid_origin_lots:'',units_per_lot:''}});
export function rulePayload(value) {
 if (!idPattern.test(value.id) || !revisionOK(value.version)) throw new Error('Enter a valid rule ID and revision.');
 const rule = structuredClone(value);
 if(rule.execution){const e=rule.execution;if(!['FOK','IOC'].includes(e.default_policy)||!decimalOK(e.markup_points)||!decimalOK(e.max_adverse_gap_bps)||exactUnits(e.max_adverse_gap_bps)>10000n*10n**18n||!Number.isSafeInteger(e.dispatch_delay_ms)||e.dispatch_delay_ms<0||e.dispatch_delay_ms>60000||!Number.isSafeInteger(e.quote_max_age_ms)||e.quote_max_age_ms<1||e.quote_max_age_ms>60000)throw new Error('Execution settings require FOK/IOC, nonnegative exact markup, delay 0-60000 ms, quote age 1-60000 ms and adverse gap 0-10000 bps.');}
 for (const name of ['groups','accounts','symbols']) for (const kind of ['include','exclude']) {
  const list = rule.scope[name][kind] || [];
  if (list.some(item => !item || item.trim() !== item || item === '*')) throw new Error('Use explicit scope values. Empty includes mean all; do not enter an asterisk.');
 }
 if (!decimalOK(rule.scope.min_lots) || (rule.scope.max_lots && (!decimalOK(rule.scope.max_lots) || exactUnits(rule.scope.max_lots) <= exactUnits(rule.scope.min_lots)))) throw new Error('Lot bounds must be exact nonnegative decimals; maximum must exceed minimum.');
 let external;
 if (rule.policy.mode === 'volume') {
  if (!decimalOK(rule.policy.volume_percent)) throw new Error('Enter an exact nonnegative volume coverage percentage.');
  external = exactUnits(rule.policy.volume_percent) > 0n;
  rule.policy = {mode:'volume',volume_percent:rule.policy.volume_percent};
 } else if (rule.policy.mode === 'whole_orders') {
  if (!decimalOK(rule.policy.selection_percent) || exactUnits(rule.policy.selection_percent) > 100n * 10n**18n || !decimalOK(rule.policy.selected_coverage_percent) || exactUnits(rule.policy.selected_coverage_percent) === 0n) throw new Error('Selection must be 0–100%; selected coverage must be positive and may exceed 100%.');
  external = exactUnits(rule.policy.selection_percent) > 0n;
  rule.policy = {mode:'whole_orders',selection_percent:rule.policy.selection_percent,selected_coverage_percent:rule.policy.selected_coverage_percent};
 } else throw new Error('Choose a coverage mode.');
 if (external && !idPattern.test(rule.connection_id)) throw new Error('Select a saved LP connection for positive external coverage.');
 return {expected_revision:rule.version,rule};
}
export function evidencePayload(value, {preserveCleanup=false,closeRenewal=false}={}) {
 if (!idPattern.test(value.connection_id) || !revisionOK(value.revision) || !revisionOK(value.connection_revision) || value.connection_revision === '0') throw new Error('Select a saved connection and current revision.');
 if (!value.symbol || /[\/\\?#\r\n\x00]/.test(value.symbol) || value.symbol.length>128) throw new Error('Enter a symbol supported by the evidence API.');
 for (const key of ['feed_id','source','evidence_id','capability_evidence_id','account_mode','effective_time_in_force']) if (!value[key]) throw new Error('Complete evidence provenance, feed, account mode and time-in-force.');
 const now = Date.now(), from = Date.parse(value.verified_at), until = Date.parse(value.valid_until);
 if (!Number.isFinite(from) || !Number.isFinite(until) || from>now || until<=now || until<=from) throw new Error('Evidence needs a past verification time and a future expiry.');
 for (const role of ['quote','trade']) {
  const ident = value[role];
  if (!ident.verified || ident.role!==role || ident.connection_id!==value.connection_id || ident.symbol!==value.symbol || ['provider','environment','upstream_account','provider_symbol_id','symbol_mapping_version','pairing_id'].some(key => !ident[key])) throw new Error('Complete and verify both account-specific quote and trade identities.');
 }
 const normalized = {...value.trade,role:'quote'};
 if (Object.keys(value.quote).some(key=>value.quote[key]!==normalized[key])) throw new Error('Quote and trade must refer to the same verified account, symbol and pairing.');
 if(value.exact_demo_sizing!==undefined&&value.exact_demo_sizing!==null){(closeRenewal?validateRetainedExactDemoEvidence:validateExactDemoEvidence)(value,now);}else{
 if (!value.grid.verified || !value.grid.evidence_id || ['min_lots','max_lots','step_lots','grid_origin_lots','units_per_lot'].some(key=>!decimalOK(value.grid[key]))) throw new Error('Enter and verify the explicit provider lot grid; no limits are assumed.');
 for (const key of ['min_lots','max_lots','step_lots','units_per_lot']) if (exactUnits(value.grid[key])===0n) throw new Error('Lot minimum, maximum, step and units per lot must be positive.');
 if (exactUnits(value.grid.max_lots)<exactUnits(value.grid.min_lots)) throw new Error('Lot maximum must not be below minimum.');
 }
 if(value.native_close){
  const n=value.native_close, nf=Date.parse(n.verified_at), nu=Date.parse(n.valid_until);
  const sourceOK=s=>value.trade.provider==='simulator'?value.trade.environment==='isolated'&&s==='simulator':value.trade.provider==='cserver'&&['isolated','demo','live'].includes(value.trade.environment)&&(s==='provider_spec'||s==='provider_demo'&&value.trade.environment==='demo');
  if(typeof n.evidence_id!=='string'||!n.evidence_id.trim()||n.evidence_id.trim()!==n.evidence_id||n.evidence_id.length>512||n.targeted_market_ioc!==true||value.account_mode!=='hedging'||value.effective_time_in_force!=='IOC'||!sourceOK(n.source)||!sourceOK(value.source)||(value.exact_demo_sizing?n.minimum_remainder_lots!=='':(!decimalOK(n.minimum_remainder_lots)||n.minimum_remainder_lots.split('.')[0].length>20))||!Number.isFinite(nf)||!Number.isFinite(nu)||nf>now||nu<=now||nu<=nf||nf<from||nu>until)throw new Error('Native close evidence requires explicit hedging IOC verification, compatible provenance, a valid contained time window and an exact nonnegative minimum remainder.');
 }
 if(value.native_cleanup){
  const n=value.native_cleanup,nf=Date.parse(n.verified_at),nu=Date.parse(n.valid_until);
  const sourceOK=s=>value.trade.provider==='simulator'?value.trade.environment==='isolated'&&s==='simulator':value.trade.provider==='cserver'&&['isolated','demo','live'].includes(value.trade.environment)&&(s==='provider_spec'||s==='provider_demo'&&value.trade.environment==='demo');
  if(typeof n.evidence_id!=='string'||!n.evidence_id.trim()||n.evidence_id.trim()!==n.evidence_id||n.evidence_id.length>512||n.targeted_limit_gtd!==true||value.account_mode!=='hedging'||!sourceOK(n.source)||!sourceOK(value.source)||!decimalOK(n.price_tick)||n.price_tick.split('.')[0].length>20||exactUnits(n.price_tick)<=0n||!Number.isFinite(nf)||!Number.isFinite(nu)||nu<=nf||(!preserveCleanup&&(nf>now||nu<=now||nf<from||nu>until)))throw new Error('Native cleanup evidence requires explicit hedging targeted limit/GTD verification, compatible provenance, a valid contained time window and a positive exact price tick.');
 }
 if(value.native_pending){
  const n=value.native_pending,nf=Date.parse(n.verified_at),nu=Date.parse(n.valid_until);
  const sourceOK=s=>value.trade.provider==='simulator'?value.trade.environment==='isolated'&&s==='simulator':value.trade.provider==='cserver'&&['isolated','demo','live'].includes(value.trade.environment)&&(s==='provider_spec'||s==='provider_demo'&&value.trade.environment==='demo');
  if(typeof n.evidence_id!=='string'||!n.evidence_id.trim()||n.evidence_id.trim()!==n.evidence_id||n.evidence_id.length>512||!['supports_limit','supports_stop','supports_gtc','supports_gtd'].every(key=>typeof n[key]==='boolean')||!(n.supports_limit||n.supports_stop)||!(n.supports_gtc||n.supports_gtd)||value.account_mode!=='hedging'||!sourceOK(n.source)||!sourceOK(value.source)||!decimalOK(n.price_tick)||n.price_tick.split('.')[0].length>20||exactUnits(n.price_tick)<=0n||!decimalOK(n.price_grid_origin)||n.price_grid_origin.split('.')[0].length>20||!Number.isFinite(nf)||!Number.isFinite(nu)||nu<=nf||(!preserveCleanup&&(nf>now||nu<=now||nf<from||nu>until)))throw new Error('Native pending evidence requires explicit order and time-in-force capabilities, compatible provenance, a contained verification window and a distinct positive price tick with nonnegative grid origin.');
 }
 if(value.native_control){
  const n=value.native_control,p=value.native_pending,nf=Date.parse(n.verified_at),nu=Date.parse(n.valid_until);
  const sourceOK=s=>value.trade.provider==='simulator'?value.trade.environment==='isolated'&&s==='simulator':value.trade.provider==='cserver'&&['isolated','demo','live'].includes(value.trade.environment)&&(s==='provider_spec'||s==='provider_demo'&&value.trade.environment==='demo');
  const referenceOK=s=>typeof s==='string'&&s.trim()===s&&s.length>0&&s.length<=512&&!/[\r\n\x00]/.test(s);
  if(!p||n.supports_cancel!==true||!['evidence_id','verifier','source_reference'].every(key=>referenceOK(n[key]))||!sourceOK(n.source)||!Number.isFinite(nf)||!Number.isFinite(nu)||nu<=nf||(!preserveCleanup&&(nf>now||nu<=now||nf<Date.parse(p.verified_at)||nu>Date.parse(p.valid_until))))throw new Error('Native cancellation requires verified pending capability, an explicit verifier and source reference, compatible provenance and a verification window contained within pending evidence.');
 }
 return {expected_revision:value.revision,evidence:structuredClone(value)};
}
export const routingErrorMessage = code => ({
 LP_PERMISSION_DENIED:'Your LP grant does not permit this rule, connection, account/group scope or coverage percentage.',
 LP_PERMISSION_UNAVAILABLE:'LP permissions are unavailable. Refresh before trying again.',
 CONFIGURATION_CONFLICT:'The saved revision changed. Refresh and review before saving again.',
 CONFIGURATION_IN_USE:'Active orders, pending commands or exposure lock this configuration. Resolve those dependencies before editing.',
 ROUTING_SCOPE_CONFLICT:'Enabled scopes overlap. Separate the indicated rules; no priority is assumed.',
 ROUTING_EVIDENCE_INVALID:'Evidence is stale or does not match this connection, account or symbol. Verify its provenance and current connection revision.',
 INVALID_INPUT:'Check the routing fields and exact decimal values.',
 LP_INVALID_REQUEST:'Check the routing fields and revision.',
 FORBIDDEN:'A broker administrator session for this tenant is required.',
 LP_CONFIGURATION_UNAVAILABLE:'Routing configuration is unavailable.',
 ROUTING_NOT_FOUND:'This saved configuration no longer exists.',
}[code] || 'The routing request could not be completed.');
export function createLPRoutingAPI(request = defaultRequest) {
 const call = async (path,method='GET',payload) => {
  let response;
  try { response = await request(path,{method,...(payload ? {headers:{'content-type':'application/json'},body:JSON.stringify(payload)} : {})}); } catch { throw new Error(routingErrorMessage()); }
  let data; try { data = await response.json(); } catch { throw new Error(routingErrorMessage()); }
  if (!response.ok) { const error = new Error(routingErrorMessage(data?.error_code)); error.code = data?.error_code; error.conflicts = Array.isArray(data?.conflicting_rules) ? data.conflicting_rules : []; error.conflictIDs = Array.isArray(data?.conflicting_rule_ids) ? data.conflicting_rule_ids.filter(id=>idPattern.test(id)) : []; throw error; }
  return data;
 };
 return {
  rules:()=>call(base+'/rules'), evidence:()=>call(base+'/evidence'), connections:()=>call('/api/v1/manager/lp-connections'),
  nativeCloseRenewal:(connection,symbol)=>call(base+'/evidence/'+encodeURIComponent(connection)+'/'+encodeURIComponent(symbol)+'/native-close-renewals'),
  renewNativeClose:record=>{if(!revisionOK(record.renewal_revision)||!record.evidence?.native_close)throw new Error('Refresh the original native close evidence before renewal.');const payload=evidencePayload(record.evidence,{preserveCleanup:true,closeRenewal:true});payload.expected_revision=record.renewal_revision;return call(base+'/evidence/'+encodeURIComponent(record.evidence.connection_id)+'/'+encodeURIComponent(record.evidence.symbol)+'/native-close-renewals','POST',payload);},
  saveRule:value=>{const payload=rulePayload(value);return call(base+'/rules'+(value.version==='0'?'':'/'+encodeURIComponent(value.id)),value.version==='0'?'POST':'PUT',payload);},
  saveEvidence:value=>{const payload=evidencePayload(value);return call(base+'/evidence'+(value.revision==='0'?'':'/'+encodeURIComponent(value.connection_id)+'/'+encodeURIComponent(value.symbol)),value.revision==='0'?'POST':'PUT',payload);}
 };
}
export const lpRouting = createLPRoutingAPI();
