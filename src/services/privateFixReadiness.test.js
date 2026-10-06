import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePrivateFIXReadiness,createPrivateFIXReadinessAPI,PRIVATE_FIX_CODES} from './privateFixReadiness.js';

const ready={tenant_id:'broker-one',observed_at:'2026-09-28T00:00:00Z',expires_at:'2026-09-28T00:00:05Z',named_lp_required:false,deployment:'enabled',
 configured:true,session:'connected',dispatch_schema_ready:true,composed:true,lifecycle_live:true,claiming:true,
 recovery_backlog:{available:true,unacknowledged:2,possibly_sent:1,oldest_age_seconds:3,truncated:false},last_error_code:'',ready:true};

test('readiness is LP-independent and strictly shaped',()=>{
 assert.equal(validatePrivateFIXReadiness(ready).ready,true);
 const off={...ready,deployment:'disabled',configured:false,session:'not_configured',composed:false,lifecycle_live:false,claiming:false,ready:false,last_error_code:'DEPLOYMENT_DISABLED'};
 assert.equal(validatePrivateFIXReadiness(off).session,'not_configured');
 for(const patch of [{named_lp_required:true},{session:'connecting'},{deployment:'on'},{last_error_code:'dial tcp 10.0.0.1'},{configured:false},
  {session:'disconnected'},{recovery_backlog:{...ready.recovery_backlog,possibly_sent:3}},{recovery_backlog:{...ready.recovery_backlog,unacknowledged:-1}},{observed_at:'yesterday'}])
  assert.throws(()=>validatePrivateFIXReadiness({...ready,...patch}),undefined,JSON.stringify(patch));
});

test('every derived code has operator text',()=>{
 for(const code of ['','DEPLOYMENT_INVALID','DEPLOYMENT_DISABLED','SESSION_NOT_CONFIGURED','DISPATCH_SCHEMA_MISSING','ADAPTER_NOT_COMPOSED','SERVICE_STOPPED','SESSION_DISCONNECTED','RECOVERY_BACKLOG_UNAVAILABLE'])
  assert.ok(PRIVATE_FIX_CODES[code]);
});

test('GET has no connection ID and maps errors without leaking detail',async()=>{
 const calls=[];let response={ok:true,json:async()=>ready};
 const api=createPrivateFIXReadinessAPI(async(path,options)=>{calls.push({path,...options});return response;});
 assert.equal((await api.get()).session,'connected');
 assert.equal(calls[0].path,'/api/v1/manager/runtime/private-fix');
 assert.equal(calls[0].method,'GET');
 response={ok:false,json:async()=>({error_code:'LP_PERMISSION_DENIED',message:'secret detail'})};
 await assert.rejects(api.get(),e=>e.code==='LP_PERMISSION_DENIED'&&!e.message.includes('secret'));
});
