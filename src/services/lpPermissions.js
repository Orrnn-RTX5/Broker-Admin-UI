import { api } from '../lib/api.js';
const base='/api/v1/manager/lp-permissions';
// Exactly the manager-backend grant actions. cleanup_recovery is the D01
// cleanup recovery action: never implied by another Manager action, and it
// needs view like every other action. This broker's Admin session can act on
// recovery without a grant; a cross-tenant SuperAdmin never can.
export const LP_GRANT_ACTIONS=['view','connection_test','configuration','trade_test','cleanup_recovery'];
export const emptyLPGrant=()=>({actions:[],scope:{all_connections:false,connection_ids:[],all_rules:false,rule_ids:[],all_accounts:false,account_ids:[],all_groups:false,group_ids:[]},max_coverage_percent:''});
export const lpGrantValues=text=>[...new Set(text.split(',').map(value=>value.trim()).filter(Boolean))];
export function lpGrantPayload(revision,grant,reason){
 if(!/^(0|[1-9][0-9]*)$/.test(revision)||!reason.trim()||reason.length>500)throw new Error('A valid revision and an audit reason are required.');
 if(!Array.isArray(grant.actions)||grant.actions.some(action=>!LP_GRANT_ACTIONS.includes(action))||new Set(grant.actions).size!==grant.actions.length)throw new Error('Select only known LP actions, each at most once.');
 if(grant.actions.length&&!grant.actions.includes('view'))throw new Error('Inspection permission is required for other LP actions.');
 if(grant.actions.includes('configuration')&&!/^(0|[1-9][0-9]*)(\.[0-9]{1,18})?$/.test(grant.max_coverage_percent))throw new Error('Set an exact nonnegative maximum coverage percentage.');
 return {expected_revision:revision,grant,reason:reason.trim()};
}
const messages={CONFIGURATION_CONFLICT:'Permissions changed. Refresh before saving again.',LP_PERMISSION_DENIED:'Only your broker administrator can grant or revoke this access.',LP_FORBIDDEN:'A broker administrator session is required.',LP_PERMISSION_UNAVAILABLE:'LP permission storage is unavailable.',LP_INVALID_REQUEST:'Check the grant fields, scope and audit reason.'};
export function createLPPermissionAdminAPI(request=options=>api.request(options)){
 const call=async(url,method='GET',data)=>{try{return(await request({url,method,data,_noRetry:true})).data;}catch(error){throw new Error(messages[error.response?.data?.error_code]||'The permission request could not be completed.');}};
 const path=login=>{if(!/^[1-9][0-9]*$/.test(login))throw new Error('Select a manager identity.');return base+'/managers/'+login;};
 return {list:(after='')=>call(base+'/managers?limit=200'+(after?'&after='+encodeURIComponent(after):'')),save:(manager,grant,reason)=>call(path(manager.login),'PUT',lpGrantPayload(manager.revision,grant,reason)),revoke:(manager,reason)=>{if(!reason.trim())throw new Error('Enter an audit reason.');return call(path(manager.login)+'/revoke','POST',{expected_revision:manager.revision,reason:reason.trim()});},audit:login=>call(path(login)+'/audit')};
}
export const lpPermissionAdmin=createLPPermissionAdminAPI();
