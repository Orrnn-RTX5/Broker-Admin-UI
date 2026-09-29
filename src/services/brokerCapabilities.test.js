import test from 'node:test';
import assert from 'node:assert/strict';
import {CAPABILITY_KEYS,capabilityReason,capabilityChangePayload,validateCapabilitiesResponse,createBrokerCapabilitiesAPI} from './brokerCapabilities.js';

const reason=(code,subject)=>({code,...(subject?{subject}:{}),required_step:`Step for ${code}.`});
const cap=(key,patch={})=>({key,title:`Title ${key}`,owner:key.startsWith('exact')?'gateway':'bridge',compiled_constant:`${key}Enabled`,required_migrations:['326_x.sql'],receipt_suite:`heavy-verification/${key}`,depends_on:[],pending_decisions:[],conflict:'c',
 compiled_in:false,desired_enabled:false,revision:'0',prerequisites_met:false,effective:false,reasons:[reason('DESIRED_OFF'),reason('NOT_COMPILED_IN',`${key}Enabled`)],change_blockers:[],conflict_in_flight:0,conflict_readable:true,effective_requires_compiled_in:true,...patch});
const env=(patch={})=>({key:'lp_connections',title:'Named LP connections',env:'LP_CONNECTIONS_ENABLED',owner:'bridge',state:'disabled',reason_code:'ENV_DISABLED',required_step:'Protected deployment step.',hot_enable:false,...patch});
const view=(patch={})=>({tenant_id:'broker-one',observed_at:'2026-09-28T00:00:00Z',registry_ready:true,change_authority:'broker_admin',capabilities:CAPABILITY_KEYS.map(k=>cap(k)),environment:[env()],...patch});

test('reason is 8..256 printable characters on one line',()=>{
 assert.equal(capabilityReason('enable after review'),'enable after review');
 for(const v of ['short',' padded reason','padded reason ','line\nbreak here','x'.repeat(257),undefined,12345678])assert.throws(()=>capabilityReason(v));
});

test('payload carries the exact revision string, a boolean and the reason',()=>{
 assert.deepEqual(capabilityChangePayload('4',true,'enable after review'),{expected_revision:'4',desired_enabled:true,reason:'enable after review'});
 for(const [r,d] of [[4,true],['04',true],['-1',true],['9007199254740993',true],['4','true']])assert.throws(()=>capabilityChangePayload(r,d,'enable after review'));
});

test('response is validated against the closed catalog and the effective conjunction',()=>{
 assert.equal(validateCapabilitiesResponse(view()).capabilities.length,4);
 const bad=[
  view({tenant_id:''}),view({change_authority:'manager'}),view({capabilities:CAPABILITY_KEYS.slice(1).map(k=>cap(k))}),
  view({capabilities:[...CAPABILITY_KEYS].reverse().map(k=>cap(k))}),
  view({capabilities:CAPABILITY_KEYS.map((k,i)=>cap(k,i===0?{effective:true}:{}))}),
  view({capabilities:CAPABILITY_KEYS.map((k,i)=>cap(k,i===0?{reasons:[reason('MADE_UP')]}:{}))}),
  view({capabilities:CAPABILITY_KEYS.map((k,i)=>cap(k,i===0?{revision:4}:{}))}),
  view({environment:[env({hot_enable:true})]}),view({environment:[env({state:'on'})]}),
  view({registry_ready:false,capabilities:CAPABILITY_KEYS.map((k,i)=>cap(k,i===0?{desired_enabled:true}:{}))}),
 ];
 for(const v of bad)assert.throws(()=>validateCapabilitiesResponse(v));
 // A fully effective capability is accepted only when every term holds.
 const on=view({capabilities:CAPABILITY_KEYS.map((k,i)=>cap(k,i===0?{compiled_in:true,desired_enabled:true,prerequisites_met:true,effective:true,reasons:[],revision:'2'}:{}))});
 assert.equal(validateCapabilitiesResponse(on).capabilities[0].effective,true);
});

test('change sends the strict body to the key path and confirms the new revision',async()=>{
 const calls=[];let response={ok:true,json:async()=>view({capabilities:CAPABILITY_KEYS.map((k,i)=>cap(k,i===0?{desired_enabled:true,revision:'1',reasons:[reason('NOT_COMPILED_IN')]}:{}))})};
 const api=createBrokerCapabilitiesAPI(async(path,options)=>{calls.push({path,...options});return response;});
 const v=await api.change('exact_pending_modify','0',true,'enable after review');
 assert.equal(v.capabilities[0].effective,false);
 assert.equal(calls[0].path,'/api/v1/manager/runtime/capabilities/exact_pending_modify');
 assert.equal(calls[0].method,'PUT');
 assert.deepEqual(JSON.parse(calls[0].body),{expected_revision:'0',desired_enabled:true,reason:'enable after review'});
 await assert.rejects(api.change('made_up','0',true,'enable after review'),/Unknown capability/);
 response={ok:true,json:async()=>view()};
 await assert.rejects(api.change('exact_pending_modify','0',true,'enable after review'),/not confirmed/);
 for(const [code,pattern] of [['CONFIGURATION_CONFLICT',/Reload/],['CONFIGURATION_IN_USE',/in flight/],['CAPABILITY_REGISTRY_UNAVAILABLE',/Migration 338/],['LP_FORBIDDEN',/broker Admin/]]){
  response={ok:false,json:async()=>({error_code:code,message:'private backend detail'})};
  await assert.rejects(api.change('exact_pending_modify','0',true,'enable after review'),e=>e.code===code&&pattern.test(e.message)&&!e.message.includes('private'));
 }
 response={ok:false,json:async()=>({error:'CAPABILITY_UNCHANGED'})};
 await assert.rejects(api.get(),e=>e.code==='CAPABILITY_UNCHANGED');
});
