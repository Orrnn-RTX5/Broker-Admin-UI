import test from 'node:test';
import assert from 'node:assert/strict';
import {nativePendingEnablementPayload,validateNativePendingEnablementResponse,nativePendingEnablementError,createLPNativePendingEnablementAPI,emptyNativePendingDraft} from './lpNativePendingEnablement.js';

const binding='a'.repeat(64);
const unconfigured={configured:false,status:{saved:null,current_evidence_revision:'7',current_binding:binding,binding_current:false,cancel_evidence_current:true,effective:false},application:'new_native_pending_placements_only'};
const saved={configured:true,status:{saved:{connection_id:'named-one',symbol:'BTCUSD',revision:'1',enabled:true,allow_limit:true,allow_stop:false,allow_gtc:true,allow_gtd:false,connection_revision:'2',evidence_revision:'7',native_pending_evidence_id:'pending-1',native_control_evidence_id:'cancel-1',capability_binding:binding,actor_login:'9000',reason:'GTC limit acceptance step 1',created_at:'2026-09-28T12:00:00Z'},current_evidence_revision:'7',current_binding:binding,binding_current:true,cancel_evidence_current:true,effective:true},application:'new_native_pending_placements_only'};
const draft={enabled:true,allow_limit:true,allow_stop:false,allow_gtc:true,allow_gtd:false,reason:'GTC limit acceptance step 1'};

test('enable payload carries exact revisions and only chosen evidenced terms',()=>{
 assert.deepEqual(nativePendingEnablementPayload('0','7',draft),{expected_revision:'0',enabled:true,allow_limit:true,allow_stop:false,allow_gtc:true,allow_gtd:false,evidence_revision:'7',reason:'GTC limit acceptance step 1'});
 const off=nativePendingEnablementPayload('1','7',{...emptyNativePendingDraft(),reason:'abort rule triggered',allow_limit:true});
 assert.equal(off.enabled,false);assert.equal(off.allow_limit,false);assert.equal(off.evidence_revision,'0');
 for(const [rev,ev,d] of [['01','7',draft],['0','0',draft],['0','7',{...draft,allow_limit:false}],['0','7',{...draft,allow_gtc:false}],['0','7',{...draft,reason:'short'}],['0','7',{...draft,reason:' padded reason'}],['0','7',{...draft,enabled:'yes'}]])assert.throws(()=>nativePendingEnablementPayload(rev,ev,d));
});

test('responses are bound to the requested instrument and default off',()=>{
 assert.equal(validateNativePendingEnablementResponse(unconfigured,'named-one','BTCUSD').configured,false);
 assert.equal(validateNativePendingEnablementResponse(saved,'named-one','BTCUSD').status.effective,true);
 assert.throws(()=>validateNativePendingEnablementResponse(saved,'named-two','BTCUSD'));
 assert.throws(()=>validateNativePendingEnablementResponse(saved,'named-one','XAUUSD'));
 assert.throws(()=>validateNativePendingEnablementResponse({...unconfigured,status:{...unconfigured.status,effective:true}},'named-one','BTCUSD'));
 assert.throws(()=>validateNativePendingEnablementResponse({...saved,application:'x'},'named-one','BTCUSD'));
});

test('client maps prerequisites and hides private backend text',async()=>{
 assert.match(nativePendingEnablementError('NATIVE_PENDING_NATIVE_CANCEL_EVIDENCE_REQUIRED'),/cancellation evidence/);
 assert.match(nativePendingEnablementError('NATIVE_PENDING_EXACT_DEMO_SIZING_EVIDENCE'),/market-only/);
 const calls=[];let response={ok:true,json:async()=>saved};
 const api=createLPNativePendingEnablementAPI(async(path,options)=>{calls.push({path,...options});return response;});
 await api.save('named-one','BTCUSD','0','7',draft);
 assert.equal(calls[0].path,'/api/v1/manager/lp-routing/native-pending-enablements/named-one/BTCUSD');
 assert.equal(calls[0].method,'PUT');
 assert.deepEqual(Object.keys(JSON.parse(calls[0].body)),['expected_revision','enabled','allow_limit','allow_stop','allow_gtc','allow_gtd','evidence_revision','reason']);
 response={ok:false,json:async()=>({error:'CONFIGURATION_CONFLICT',message:'private backend data'})};
 await assert.rejects(api.get('named-one','BTCUSD'),e=>e.code==='CONFIGURATION_CONFLICT'&&!e.message.includes('private'));
 await assert.rejects(api.get('named-one','BTC/USD'));
});

test('a save is confirmed only by a new revision recording the submitted choice',async()=>{
 const reply={value:saved};
 const api=createLPNativePendingEnablementAPI(async()=>({ok:true,json:async()=>reply.value}));
 assert.equal((await api.save('named-one','BTCUSD','0','7',draft)).status.saved.revision,'1');
 const refused=async(value,expected,d=draft)=>{reply.value=value;await assert.rejects(api.save('named-one','BTCUSD',expected,'7',d),/not confirmed/);};
 const off={...emptyNativePendingDraft(),reason:'Disable after QA review'};
 const disabledRecord={...saved,status:{...saved.status,effective:false,binding_current:false,saved:{...saved.status.saved,revision:'2',enabled:false,allow_limit:false,allow_gtc:false,capability_binding:'',reason:'Disable after QA review'}}};
 await refused(saved,'1',off);                                   // stale echo of the prior revision
 await refused(disabledRecord,'0');                               // enable requested, disabled recorded
 await refused({...saved,status:{...saved.status,saved:{...saved.status.saved,allow_stop:true}}},'0'); // different terms
 await refused({...saved,status:{...saved.status,saved:{...saved.status.saved,evidence_revision:'6'}}},'0'); // other evidence
 await refused(unconfigured,'0');
 reply.value=disabledRecord;
 assert.equal((await api.save('named-one','BTCUSD','1','7',off)).status.saved.enabled,false);
});
