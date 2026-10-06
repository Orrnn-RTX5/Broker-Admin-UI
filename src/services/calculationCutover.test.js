import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCutoverDraft,readCutoverPreview,readCutoverPending,saveCutoverPending,readCutoverStatus,clearCutoverPending,withCutoverWriteLock,CUTOVER_TEMPLATE} from './calculationCutover.js';

const scope=JSON.stringify(['1002','test-broker','session-a']);
const parent='11111111-1111-4111-8111-111111111111',root='22222222-2222-4222-8222-222222222222';
const account='33333333-3333-4333-8333-333333333333',assignment='44444444-4444-4444-8444-444444444444';
const review=()=>({kind:'calculation_additive_cutover',ready:true,broker_id:'test-broker',tenant_id:'test-broker',legal_entity_id:'entity',
 impact:'scoped_additive_calculation_cutover',economic_equivalence:'existing_definitions_unchanged',reason:'dedicated XAUUSD account',
 fingerprint:'a'.repeat(64),settings_export_hash:'b'.repeat(64),parent_policy_version_id:parent,root_policy_version_id:root,parent_event_sequence:'7',
 blockers:[],other_accounts:[{account_login:'200001',group:'Bidyut',reason:'group_gains_symbols_account_not_moved'}],
 added_definitions:[{key:'s:'+'c'.repeat(64),kind:'symbol',group_name:'Demo',symbol:'XAUUSD',hash:'d'.repeat(64)}],
 settings_review:[{group_name:'Demo',symbol:'XAUUSD',current_instrument_json:'{"contract_size":9007199254740993.001}',current_group_json:'{}',current_symbol_override_json:'null',proposed:{contract_size:'100'}}],
 accounts:[{account_id:account,account_login:'9007199254740993',group:'Demo',currency:'USD',cutover_kind:'MOVED_ACCOUNT',current_policy_version_id:parent,previous_assignment_id:assignment,
  previous_assignment_version:'1',account_revision:'12',checkpoint_source_revision:'11',checkpoint_balance:'12345678901234567890.01',checkpoint_credit:'-0.0001',checkpoint_source:'projection-revision:12',
  open_positions:0,pending_orders:0,unresolved_commands:0,in_flight_lp_uses:0,source_hash:'e'.repeat(64),current_hidden_opening_markup_points:'0',gained_symbols:['XAUUSD']}]});
function storage(){const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};}

test('cutover draft is strict and preserves exact numbers',()=>{
 const draft=parseCutoverDraft('{"reason":"add XAUUSD","move_accounts":[{"account_id":"'+account+'","account_login":200002}]}');
 assert.equal(draft.move_accounts[0].account_login,200002);
 for(const bad of ['[]','{"reason":"r"}','{"reason":" r","accounts":[{}]}','{"reason":"r","accounts":{}}','{"reason":"r","draft":{},"accounts":[{}]}','{"reason":"r","accounts":[{"account_login":9007199254740993}]}'])
  assert.throws(()=>parseCutoverDraft(bad),bad);
 assert.throws(()=>parseCutoverDraft('x'.repeat(65537)));
 assert.doesNotThrow(()=>JSON.parse(CUTOVER_TEMPLATE));
});

test('review keeps exact text and refuses activity or incomplete scope',()=>{
 const value=readCutoverPreview(review());
 assert.equal(value.accounts[0].checkpoint_balance,'12345678901234567890.01');
 assert.equal(value.accounts[0].account_login,'9007199254740993');
 assert.equal(value.settings_review[0].current_instrument_json,'{"contract_size":9007199254740993.001}');
 const mutate=change=>{const next=review();change(next);return next;};
 for(const change of [
  v=>{v.accounts[0].open_positions=1;},v=>{v.accounts[0].in_flight_lp_uses=1;},v=>{v.accounts[0].checkpoint_balance=1.5;},
  v=>{v.accounts[0].previous_assignment_id='';},v=>{v.accounts=[];},v=>{v.blockers=['x'];},v=>{v.parent_event_sequence='0';},
  v=>{v.impact='broker_wide_exact_calculation';},v=>{v.economic_equivalence='operator_review_required';},v=>{v.accounts[0].cutover_kind='REWRITE';},
  v=>{v.accounts.push(structuredClone(v.accounts[0]));},v=>{v.added_definitions[0].hash='zz';}
 ]) assert.throws(()=>readCutoverPreview(mutate(change)));
 const blocked=mutate(v=>{v.ready=false;v.blockers=['account_not_quiescent:1'];v.accounts[0].open_positions=2;v.accounts[0].account_revision='-1';v.fingerprint='f'.repeat(64);});
 assert.equal(readCutoverPreview(blocked).ready,false);
});

test('original cutover identity survives absence and clears only on the matching active release',()=>{
 const store=storage();
 const record=saveCutoverPending(store,scope,'9007199254740993',review());
 assert.deepEqual(readCutoverPending(store,scope),record);
 assert.throws(()=>saveCutoverPending(store,scope,'9007199254740993',review()));
 assert.throws(()=>clearCutoverPending(store,scope,record,{status:'absent',fingerprint:record.fingerprint}));
 assert.deepEqual(readCutoverPending(store,scope),record);
 const release={state:'ACTIVE',broker_id:'test-broker',settings_export_hash:'b'.repeat(64),impact_report_hash:'a'.repeat(64)};
 assert.throws(()=>readCutoverStatus({status:'active',fingerprint:record.fingerprint,release:{...release,impact_report_hash:'0'.repeat(64)}},record));
 assert.throws(()=>readCutoverStatus({status:'active',fingerprint:record.fingerprint,release:{...release,broker_id:'other'}},record));
 clearCutoverPending(store,scope,record,{status:'active',fingerprint:record.fingerprint,release});
 assert.equal(readCutoverPending(store,scope),null);
 const other=JSON.stringify(['1002','other-broker','session-a']);
 assert.throws(()=>saveCutoverPending(storage(),other,'1',review()));
});

test('cutover writes require one available browser lock',async()=>{
 let occupied=false;const calls=[];
 const locks={request:async(name,options,operation)=>{assert.equal(options.ifAvailable,true);if(occupied)return operation(null);occupied=true;try{return await operation({name});}finally{occupied=false;}}};
 let release;const gate=new Promise(resolve=>release=resolve);
 const first=withCutoverWriteLock(locks,scope,async()=>{calls.push('original');await gate;return 'done';});
 await assert.rejects(withCutoverWriteLock(locks,scope,async()=>calls.push('duplicate')));
 await assert.rejects(withCutoverWriteLock(undefined,scope,async()=>calls.push('uncoordinated')));
 release();assert.equal(await first,'done');assert.deepEqual(calls,['original']);
});
