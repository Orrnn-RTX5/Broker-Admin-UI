import test from 'node:test';
import assert from 'node:assert/strict';
import {modifyAdmissionLimit,modifyAdmissionPayload,validateModifyAdmissionResponse,createLPExactPendingModifyAdmissionAPI} from './lpExactPendingModifyAdmission.js';

const unconfigured={configured:false,revision:'0',max_unsuccessful_modify_per_ticket:3,default:3,min:1,max:128,application:'new_modify_admissions_only'};
const saved={...unconfigured,configured:true,revision:'9007199254740993',max_unsuccessful_modify_per_ticket:5};

test('limit is a whole number from 1 to 128',()=>{
 for(const v of ['1','128',1,128,'3'])assert.equal(modifyAdmissionLimit(v),Number(v));
 for(const v of ['0','129',0,129,'1.5',1.5,'',' 3','03','-1','1e2',null,undefined])assert.throws(()=>modifyAdmissionLimit(v));
});

test('payload carries the exact expected revision as a string',()=>{
 assert.deepEqual(modifyAdmissionPayload('0','3'),{expected_revision:'0',max_unsuccessful_modify_per_ticket:3});
 assert.equal(modifyAdmissionPayload('9007199254740993',7).expected_revision,'9007199254740993');
 for(const r of [0,1,'01','-1','9223372036854775807',undefined])assert.throws(()=>modifyAdmissionPayload(r,'3'));
});

test('response: revision is a string, "0" exactly when unconfigured, bounds are fixed',()=>{
 assert.equal(validateModifyAdmissionResponse(unconfigured).revision,'0');
 assert.equal(validateModifyAdmissionResponse(saved).revision,'9007199254740993');
 assert.equal(validateModifyAdmissionResponse({...saved,additive:true}).configured,true);
 for(const patch of [{revision:0},{revision:'1'},{configured:'false'},{max_unsuccessful_modify_per_ticket:0},{max_unsuccessful_modify_per_ticket:129},{default:4},{min:0},{max:256},{application:'all_modify_requests'}])assert.throws(()=>validateModifyAdmissionResponse({...unconfigured,...patch}));
 assert.throws(()=>validateModifyAdmissionResponse({...saved,revision:'0'}));
});

test('PUT sends only the strict body; conflict and unavailable codes map without leaking messages',async()=>{
 const calls=[];let response={ok:true,json:async()=>({...saved,revision:'1',max_unsuccessful_modify_per_ticket:5})};
 const api=createLPExactPendingModifyAdmissionAPI(async(path,options)=>{calls.push({path,...options});return response;});
 const v=await api.save('0','5');
 assert.equal(v.revision,'1');
 assert.equal(calls[0].path,'/api/v1/manager/lp-routing/exact-pending-modify-admission');
 assert.equal(calls[0].method,'PUT');
 assert.deepEqual(JSON.parse(calls[0].body),{expected_revision:'0',max_unsuccessful_modify_per_ticket:5});
 for(const [code,pattern] of [['CONFIGURATION_CONFLICT',/Reload/],['EXACT_PENDING_MODIFY_POLICY_UNAVAILABLE',/Migration 326/],['INVALID_INPUT',/1 to 128/],['FORBIDDEN',/not authorized/]]){
  response={ok:false,json:async()=>({error_code:code,message:'private backend detail'})};
  await assert.rejects(api.save('0','5'),e=>e.code===code&&pattern.test(e.message)&&!e.message.includes('private'));
 }
 response={ok:false,json:async()=>({error:'CONFIGURATION_CONFLICT'})};
 await assert.rejects(api.get(),e=>e.code==='CONFIGURATION_CONFLICT');
});

test('save must be confirmed by a newer revision with the submitted value',async()=>{
 let body=saved;
 const api=createLPExactPendingModifyAdmissionAPI(async()=>({ok:true,json:async()=>body}));
 body={...saved,revision:'4',max_unsuccessful_modify_per_ticket:5};
 await assert.rejects(api.save('4','5'),/not confirmed/);
 body={...saved,revision:'5',max_unsuccessful_modify_per_ticket:6};
 await assert.rejects(api.save('4','5'),/not confirmed/);
 body=unconfigured;
 await assert.rejects(api.save('0','3'),/not confirmed/);
 body={...saved,revision:'5',max_unsuccessful_modify_per_ticket:5};
 assert.equal((await api.save('4','5')).revision,'5');
});
