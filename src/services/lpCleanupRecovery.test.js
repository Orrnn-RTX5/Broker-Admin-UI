import test from 'node:test';
import assert from 'node:assert/strict';
import {createLPCleanupRecoveryAPI,validateCleanupRecovery,cleanupRecoveryPayload,validateCleanupRecoveryAccepted,cleanupRecoveryActions} from './lpCleanupRecovery.js';

const intent='intent-1';
const options=(permitted={})=>cleanupRecoveryActions.map(action=>({action,permitted:Boolean(permitted[action]),reason:permitted[action]?'permitted':'plan_not_escalated_by_limit',mutating:action==='authorize_recovery_round'}));
const read={intent_id:intent,plan_id:'plan-1',plan_revision:'9007199254740993',status:'escalated',escalation:'price_limit',remaining:'0.25',attributable:'1.5',attempts:2,unreconciled_attempts:0,rounds_authorized:0,max_rounds:1,mutations_enabled:true,actor_can_act:true,required_permission:'lp_cleanup_recovery',options:options({acknowledge:true,authorize_recovery_round:true}),forbidden_actions:['force_close_position','mark_flat','edit_remaining_quantity','waive_or_zero_costs','book_customer','release_configuration','resend_same_clordid','emergency_override']};
const fake=(response)=>{const calls=[];const request=async(path,opts)=>{calls.push({path,...opts});const r=typeof response==='function'?response(path,opts):response;return {ok:r.status>=200&&r.status<300,status:r.status,json:async()=>r.body};};return {calls,api:createLPCleanupRecoveryAPI(request)};};

test('get reads the scoped route and keeps the exact string revision',async()=>{
 const {calls,api}=fake({status:200,body:read});
 const v=await api.get(intent);
 assert.equal(calls[0].path,'/api/v1/manager/lp-journal/intent-1/cleanup-recovery');
 assert.equal(calls[0].method,'GET');assert.equal(calls[0].body,undefined);
 assert.equal(v.plan_revision,'9007199254740993');assert.equal(v.remaining,'0.25');assert.equal(v.actor_can_act,true);
 await assert.rejects(api.get('bad/intent'),e=>e.code==='INVALID_INPUT');
});

test('malformed recovery reads fail closed',()=>{
 assert.doesNotThrow(()=>validateCleanupRecovery(read,intent));
 for(const patch of [
  {intent_id:'other'},{plan_revision:Number('9007199254740993')},{plan_revision:'0'},{plan_revision:'01'},{status:'flat'},
  {remaining:0.25},{remaining:'1e2'},{attributable:'-1'},{attempts:'2'},{unreconciled_attempts:3},{rounds_authorized:-1},{max_rounds:0},
  {mutations_enabled:'true'},{actor_can_act:undefined},{required_permission:'broker_admin'},
  {options:options().slice(0,3)},{options:[...options().slice(0,3),{action:'mark_flat',permitted:true,reason:'permitted',mutating:true}]},
  {options:options().map(o=>o.action==='acknowledge'?{...o,permitted:true}:o)},
  {options:options().map(o=>o.action==='acknowledge'?{...o,mutating:true}:o)},
  {status:'held',options:options({authorize_recovery_round:true})},
  {forbidden_actions:['acknowledge']},{forbidden_actions:'mark_flat'},
 ])assert.throws(()=>validateCleanupRecovery({...read,...patch},intent),e=>e.code==='INVALID_RESPONSE',JSON.stringify(patch));
});

test('payload requires a known action, string revision and a bounded note',()=>{
 const ok={action:'acknowledge',expected_plan_revision:'9007199254740993',note:'checked'};
 assert.deepEqual(cleanupRecoveryPayload(ok),ok);
 assert.equal(cleanupRecoveryPayload({...ok,note:'x'.repeat(500)}).note.length,500);
 for(const patch of [{action:'mark_flat'},{action:'force_close_position'},{expected_plan_revision:Number('9007199254740993')},{expected_plan_revision:'0'},{expected_plan_revision:'9223372036854775808'},{note:''},{note:'   '},{note:'x'.repeat(501)},{note:'é'.repeat(251)},{note:undefined}])assert.throws(()=>cleanupRecoveryPayload({...ok,...patch}),e=>e.code==='INVALID_INPUT',JSON.stringify(patch));
});

test('act posts the exact body and accepts only 202 accepted/completed=false',async()=>{
 const {calls,api}=fake({status:202,body:{action:'acknowledge',accepted:true,completed:false}});
 const v=await api.act(intent,{action:'acknowledge',expected_plan_revision:'9007199254740993',note:'reviewed'});
 assert.deepEqual(v,{action:'acknowledge',accepted:true,completed:false});
 assert.equal(calls[0].method,'POST');assert.equal(calls[0].path,'/api/v1/manager/lp-journal/intent-1/cleanup-recovery/actions');
 assert.deepEqual(Object.keys(calls[0].headers),['content-type']);
 assert.deepEqual(JSON.parse(calls[0].body),{action:'acknowledge',expected_plan_revision:'9007199254740993',note:'reviewed'});
 for(const [status,body] of [[200,{action:'acknowledge',accepted:true,completed:false}],[202,{action:'acknowledge',accepted:true}],[202,{action:'acknowledge',accepted:true,completed:true}],[202,{action:'observe_original_position',accepted:true,completed:false}],[202,{action:'acknowledge',accepted:true,completed:false,round:{round:1}}]])assert.throws(()=>validateCleanupRecoveryAccepted(status,body,'acknowledge'),e=>e.code==='INVALID_RESPONSE');
});

test('a round must carry its bounded budget',()=>{
 const round={round:1,attempt_offset:2,max_attempts:3,deadline:'2026-09-28T12:00:00Z',remaining:'0.25'};
 assert.deepEqual(validateCleanupRecoveryAccepted(202,{action:'authorize_recovery_round',accepted:true,completed:false,round},'authorize_recovery_round').round,round);
 for(const r of [undefined,{...round,round:0},{...round,max_attempts:11},{...round,deadline:'soon'},{...round,remaining:0.25}])assert.throws(()=>validateCleanupRecoveryAccepted(202,{action:'authorize_recovery_round',accepted:true,completed:false,round:r},'authorize_recovery_round'));
});

test('server refusals map to fixed messages, NOT_PERMITTED shows the reason',async()=>{
 for(const [status,code] of [[503,'LP_CLEANUP_RECOVERY_DISABLED'],[409,'CLEANUP_PLAN_REVISION_CONFLICT'],[503,'LP_CLEANUP_RECOVERY_UNCONFIRMED'],[403,'FORBIDDEN'],[404,'LP_CLEANUP_NOT_FOUND']]){
  const {api}=fake({status,body:{error_code:code,message:'private upstream detail'}});
  await assert.rejects(api.act(intent,{action:'acknowledge',expected_plan_revision:'5',note:'n'}),e=>e.code===code&&!e.message.includes('private'));
 }
 const {api}=fake({status:409,body:{error_code:'CLEANUP_RECOVERY_NOT_PERMITTED',reason:'native_position_mismatch'}});
 await assert.rejects(api.act(intent,{action:'authorize_recovery_round',expected_plan_revision:'5',note:'n'}),e=>e.code==='CLEANUP_RECOVERY_NOT_PERMITTED'&&e.reason==='native_position_mismatch'&&e.message.includes('native_position_mismatch'));
 const invalid=createLPCleanupRecoveryAPI(async()=>{throw Error('offline');});
 await assert.rejects(invalid.get(intent),/request failed/);
});
