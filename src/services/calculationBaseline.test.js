import test from 'node:test';
import assert from 'node:assert/strict';

test('source review retains numeric text and cannot become an importable cross-broker policy',async()=>{
 const {readBaselineSources}=await import('./calculationBaseline.js');
 const raw='{"login":"9007199254740993","balance":9007199254740993.000000000000000001}';
 const value={kind:'calculation_source_review',importable:false,broker_id:'test-broker',observed_at:'2026-09-27T00:00:00Z',source_snapshot_hash:'d'.repeat(64),required_inputs:['Review policy'],accounts_json:[raw],groups_json:[],instruments_json:[],symbol_overrides_json:[],hidden_markups_json:[],account_feeds_json:[],group_feeds_json:[]};
 assert.equal(readBaselineSources(value,scope).accounts_json[0],raw);
 assert.throws(()=>parseBaselineDraft(JSON.stringify(value)));
 assert.throws(()=>readBaselineSources({...value,importable:true},scope));
 assert.throws(()=>readBaselineSources({...value,broker_id:'other'},scope));
 assert.throws(()=>readBaselineSources({...value,accounts_json:[JSON.parse(raw)]},scope));
 assert.throws(()=>readBaselineSources({...value,groups_json:['null']},scope));
});

test('cross-tab activation requires one available browser lock before any write',async()=>{
 const {withBaselineWriteLock}=await import('./calculationBaseline.js');
 let occupied=false,release;
 const gate=new Promise(resolve=>release=resolve),calls=[];
 const locks={request:async(name,options,operation)=>{
  assert.equal(options.ifAvailable,true);assert.equal(options.mode,'exclusive');
  if(occupied)return operation(null);
  occupied=true;
  try{return await operation({name});}finally{occupied=false;}
 }};
 const first=withBaselineWriteLock(locks,scope,async()=>{calls.push('original');await gate;return 'confirmed';});
 await assert.rejects(withBaselineWriteLock(locks,scope,async()=>calls.push('duplicate')));
 assert.deepEqual(calls,['original']);
 release();assert.equal(await first,'confirmed');
 await assert.rejects(withBaselineWriteLock(undefined,scope,async()=>calls.push('uncoordinated')));
 assert.deepEqual(calls,['original']);
});

import {baselineAccountPricing,baselineLogin,parseBaselineDraft,readBaselinePreview,readBaselinePending,saveBaselinePending,readBaselineStatus,clearBaselinePending} from './calculationBaseline.js';
const scope=JSON.stringify(['1002','test-broker','session-a']);
const review=()=>({...{economic_equivalence:'operator_review_required',settings_review:[{group_name:'Demo',symbol:'EURUSD',current_instrument_json:'{"contract_size":9007199254740993.001}',current_group_json:'{}',current_symbol_override_json:'null',proposed:{contract_size:'9007199254740993.001'}}],proposed_commissions:[]},ready:true,broker_id:'test-broker',tenant_id:'test-broker',impact:'broker_wide_exact_calculation',fingerprint:'a'.repeat(64),settings_export_hash:'b'.repeat(64),blockers:[],accounts:[{account_id:'account-one',current_hidden_opening_markup_points:'0.125',proposed_calculation_settings:{currency:'USD',currency_scale:2,rounding_mode:'half_up',position_mode:'hedging',lot_divisor:'100',leverage:'100',hidden_opening_markup_points:'9007199254740993.000000000000000001'},account_login:'9007199254740993',group:'Demo',currency:'USD',balance:'12345678901234567890.0100',credit:'-0.0001',account_revision:'0',open_positions:0,pending_orders:0,unresolved_commands:0}]});
function storage(){const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};}
test('review preserves exact financial values and large account login',()=>{
 assert.equal(baselineLogin('9007199254740993'),'9007199254740993');
 assert.throws(()=>baselineLogin('9223372036854775808'));
 const input=review(),out=readBaselinePreview(input);
 assert.equal(out.accounts[0].balance,'12345678901234567890.0100');
 assert.equal(out.settings_review[0].current_instrument_json,'{"contract_size":9007199254740993.001}');
 const missing=review();delete missing.settings_review;assert.throws(()=>readBaselinePreview(missing));
 const blocked=review();blocked.ready=false;blocked.blockers=['missing_revision'];blocked.accounts[0].account_revision='-1';assert.equal(readBaselinePreview(blocked).ready,false);
 out.accounts[0].balance='0';assert.notEqual(out.accounts[0].balance,input.accounts[0].balance);
 for(const mutate of [x=>x.accounts[0].balance=100,x=>x.accounts[0].balance='1x2',x=>x.accounts[0].unresolved_commands=1,x=>x.accounts[0].account_revision=0,x=>x.accounts.push({...x.accounts[0]}),x=>x.blockers.push('Blocked')]){
  const value=review();mutate(value);assert.throws(()=>readBaselinePreview(value));
 }
});
test('policy import rejects integer loss before any request',()=>{
 assert.deepEqual(parseBaselineDraft('{"accounts":[{"account_login":1001}]}'),{accounts:[{account_login:1001}]});
 assert.throws(()=>parseBaselineDraft('{"accounts":[{"account_login":9007199254740993}]}'));
 assert.throws(()=>parseBaselineDraft('{"accounts":[]}'));
 assert.throws(()=>parseBaselineDraft(' '.repeat(65537)));
});
test('one durable activation survives reload and same principal re-login only',()=>{
 const disk=storage(),record=saveBaselinePending(disk,scope,'9007199254740993',review());
 const relogin=JSON.stringify(['1002','test-broker','session-b']);
 assert.deepEqual(readBaselinePending(disk,relogin),record);
 assert.equal(readBaselinePending(disk,JSON.stringify(['1003','test-broker','session-a'])),null);
 assert.equal(readBaselinePending(disk,JSON.stringify(['1002','foreign-broker','session-a'])),null);
 assert.throws(()=>saveBaselinePending(disk,relogin,record.account_login,review()));
 assert.throws(()=>clearBaselinePending(disk,relogin,record,{status:'pending',fingerprint:record.fingerprint}));
 assert.deepEqual(readBaselinePending(disk,relogin),record);
 const active={status:'active',fingerprint:record.fingerprint,release:{state:'ACTIVE',broker_id:'test-broker',tenant_id:'test-broker',settings_export_hash:record.settings_export_hash}};
 assert.throws(()=>readBaselineStatus({...active,release:{...active.release,settings_export_hash:'c'.repeat(64)}},record));
 clearBaselinePending(disk,relogin,record,active);
 assert.equal(readBaselinePending(disk,relogin),null);
});
test('unavailable, corrupted or changing durable storage refuses activation',()=>{
 assert.throws(()=>saveBaselinePending(null,scope,'1001',review()));
 assert.throws(()=>saveBaselinePending({getItem:()=>null,setItem:()=>{},removeItem:()=>{}},scope,'1001',review()));
 assert.throws(()=>readBaselinePending({getItem:()=>'{broken'},scope));
 assert.throws(()=>readBaselinePending({getItem:()=>JSON.stringify({version:1})},scope));
 const disk=storage(),record=saveBaselinePending(disk,scope,'1001',review());
 assert.throws(()=>clearBaselinePending(disk,scope,record,{status:'absent',fingerprint:'f'.repeat(64)}));
 assert.throws(()=>clearBaselinePending(disk,scope,record,{status:'absent',fingerprint:record.fingerprint}));
 assert.deepEqual(readBaselinePending(disk,scope),record);
});

test('account pricing review preserves exact points and refuses missing or malformed settings',()=>{
 const value=review(),row=value.accounts[0];
 assert.deepEqual(baselineAccountPricing(row),{current:'0.125',proposed:'9007199254740993.000000000000000001'});
 assert.equal(readBaselinePreview(value).accounts[0].proposed_calculation_settings.hidden_opening_markup_points,'9007199254740993.000000000000000001');
 delete row.proposed_calculation_settings.hidden_opening_markup_points;
 assert.equal(baselineAccountPricing(row).proposed,'0');
 for(const bad of [null,0,1.5,'-1','NaN']){row.proposed_calculation_settings.hidden_opening_markup_points=bad;assert.throws(()=>readBaselinePreview(value));}
 delete row.proposed_calculation_settings;
 assert.throws(()=>readBaselinePreview(value));
 value.ready=false;value.blockers=['missing account definition'];assert.equal(baselineAccountPricing(row,false).proposed,null);assert.equal(readBaselinePreview(value).ready,false);
 row.current_hidden_opening_markup_points=0;assert.throws(()=>readBaselinePreview(value));
});

import {baselineAccountMarginBoundary} from './calculationBaseline.js';
test('account rounding requires exact optional authority and complete matching symbol review',()=>{
 const value=review(),row=value.accounts[0];
 assert.equal(baselineAccountMarginBoundary(row.proposed_calculation_settings),'symbol_total');
 assert.equal(readBaselinePreview(value).ready,true);
 row.proposed_calculation_settings.margin_rounding_boundary='account_total';
 assert.throws(()=>readBaselinePreview(value),/every reviewed group symbol/);
 value.settings_review[0].proposed.margin_rounding_boundary='symbol_total';
 value.settings_review[0].proposed.hedge_method='gross';
 const accepted=readBaselinePreview(value);
 assert.equal(baselineAccountMarginBoundary(accepted.accounts[0].proposed_calculation_settings),'account_total');
 value.settings_review[0].proposed.margin_rounding_boundary='components';
 assert.throws(()=>readBaselinePreview(value),/every reviewed group symbol/);
 assert.equal(accepted.settings_review[0].proposed.margin_rounding_boundary,'symbol_total');
 value.settings_review[0].proposed.margin_rounding_boundary='symbol_total';
 value.settings_review[0].group_name='foreign-group';
 assert.throws(()=>readBaselinePreview(value),/every reviewed group symbol/);
 value.settings_review[0].group_name=row.group;
 for(const bad of [null,'','symbol_total','gross',0,false,{}]){
  row.proposed_calculation_settings.margin_rounding_boundary=bad;
  assert.throws(()=>readBaselinePreview(value),/rounding boundary/);
 }
 delete row.proposed_calculation_settings.margin_rounding_boundary;
 assert.equal(readBaselinePreview(value).ready,true);
});
test('a 403 keeps the explicit server reason; the generic authority text only when none is given',async()=>{
 const {readCalculationRefusal}=await import('./calculationBaseline.js');
 assert.equal(readCalculationRefusal({status:403,data:{error_code:'POLICY_RELEASE_AUTHORITY_REVOKED'}}),'Current broker administrator authority for this account is not held: the session was revoked or the account is not in this broker (POLICY_RELEASE_AUTHORITY_REVOKED).');
 assert.equal(readCalculationRefusal({status:403,data:{message:'Admin access for this broker is required',code:'MT_RET_ERR_PERMISSIONS'}}),'Admin access for this broker is required (MT_RET_ERR_PERMISSIONS).');
 assert.equal(readCalculationRefusal({status:403,data:{error_code:'SOMETHING_NEW'}}),'Current broker administrator authority is required (SOMETHING_NEW).');
 assert.equal(readCalculationRefusal({status:403,data:'Denied by policy'}),'Denied by policy');
 assert.equal(readCalculationRefusal({status:403,data:{}}),'Current broker administrator authority is required.');
 assert.equal(readCalculationRefusal({status:403,data:'<html>403</html>'}),'Current broker administrator authority is required.');
 assert.equal(readCalculationRefusal({status:503,data:{error_code:'POLICY_RELEASE_UNAVAILABLE'}}),'The baseline request was not confirmed. Review the current state before continuing.');
});
