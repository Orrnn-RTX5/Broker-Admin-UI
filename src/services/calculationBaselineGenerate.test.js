import test from 'node:test';
import assert from 'node:assert/strict';
import {BASELINE_DRAFT_LIMIT_BYTES,buildBaselineGenerateRequest,parseBaselineDraft,readBaselineGenerate,readBaselineGenerateRefusal} from './calculationBaseline.js';

// "Generate draft from current settings" (FIX 3 contract): request building,
// response checks and refusal text. Generic fixtures only.
const attest={execution:' Execution text ',risk:'Risk text',fx:'FX text'};
const draft={accounts:[{login:'1001',currency:'USD'}],groups:[{name:'GroupA'}]};

test('the policy limit is 1 MiB: 1048576 bytes pass, one more byte is refused',()=>{
 assert.equal(BASELINE_DRAFT_LIMIT_BYTES,1048576);
 const base=JSON.stringify({...draft,pad:''});
 const fit=JSON.stringify({...draft,pad:'x'.repeat(BASELINE_DRAFT_LIMIT_BYTES-base.length)});
 assert.equal(new TextEncoder().encode(fit).length,BASELINE_DRAFT_LIMIT_BYTES);
 assert.ok(parseBaselineDraft(fit).accounts.length);
 assert.throws(()=>parseBaselineDraft(fit.replace('"pad":"','"pad":"x')),/at most 1 MB/);
});

test('generate request: attestations required, optional fields omitted when blank',()=>{
 assert.deepEqual(buildBaselineGenerateRequest(attest),{attestation:{execution:'Execution text',risk:'Risk text',fx:'FX text'}});
 assert.throws(()=>buildBaselineGenerateRequest({...attest,risk:'  '}),/Risk policy attestation/);
 assert.throws(()=>buildBaselineGenerateRequest({}),/Execution policy, Risk policy, FX conversion policy/);
 assert.deepEqual(buildBaselineGenerateRequest({...attest,symbolGroups:'GroupA\n groupB , GroupA,,\n',acceptGroupCommissions:true,zeroCommissionReason:' none ',calculationPolicyId:' policy-1 '}),{
  attestation:{execution:'Execution text',risk:'Risk text',fx:'FX text'},
  symbol_groups:['GroupA','groupB'],accept_group_commissions:true,zero_commission_reason:'none',calculation_policy_id:'policy-1',
 });
 assert.equal('accept_group_commissions' in buildBaselineGenerateRequest({...attest,acceptGroupCommissions:'yes'}),false,'only a real true is sent');
});

test('generate response: draft text, blockers and warnings are read exactly',()=>{
 const value=readBaselineGenerate({draft,blockers:[{code:'account_not_quiescent',subject:'1001',message:'close it'}],warnings:[{code:'symbol_without_fx_path',message:'left out'}],summary:{accounts:1,bytes:10}});
 assert.deepEqual(JSON.parse(value.text),draft);
 assert.match(value.text,/\n {2}"accounts"/,'pretty-printed');
 assert.deepEqual(value.blockers,[{code:'account_not_quiescent',subject:'1001',message:'close it'}]);
 assert.deepEqual(value.warnings,[{code:'symbol_without_fx_path',subject:'',message:'left out'}]);
 assert.deepEqual(value.summary,{accounts:1,bytes:10});
 const none=readBaselineGenerate({draft:null,blockers:[{code:'mixed_tenant',subject:'',message:'x'}],warnings:[]});
 assert.equal(none.text,'');
 assert.deepEqual(none.summary,{});
});

test('generate response: a draft too large when pretty-printed is kept compact',()=>{
 const big={...draft,rows:Array.from({length:8000},(_,i)=>({a:i,b:1,c:2,d:3,e:4,name:'n'.repeat(60)}))};
 assert.ok(JSON.stringify(big,null,2).length>BASELINE_DRAFT_LIMIT_BYTES&&JSON.stringify(big).length<=BASELINE_DRAFT_LIMIT_BYTES);
 assert.equal(readBaselineGenerate({draft:big,blockers:[],warnings:[]}).text,JSON.stringify(big));
});

test('generate response: malformed shapes are refused',()=>{
 for(const value of [null,[],{draft:[],blockers:[],warnings:[]},{draft,blockers:{},warnings:[]},{draft,blockers:[],warnings:[{code:1,message:'x'}]}]){
  assert.throws(()=>readBaselineGenerate(value));
 }
});

test('generate refusal shows the server reason; 403 keeps the authority wording; 413 names the limit',()=>{
 assert.equal(readBaselineGenerateRefusal({status:400,data:{message:'attestation.fx is required',code:'MT_RET_ERR_PARAMS'}}),'attestation.fx is required (MT_RET_ERR_PARAMS).');
 assert.equal(readBaselineGenerateRefusal({status:403,data:{}}),'Current broker administrator authority is required.');
 assert.match(readBaselineGenerateRefusal({status:413,data:''}),/1 MB policy limit/);
 assert.equal(readBaselineGenerateRefusal({status:502,data:'<html>bad gateway</html>'}),'The draft could not be generated (HTTP 502). Check the account login and try again.');
 assert.equal(readBaselineGenerateRefusal({status:404,data:''}),'Draft generation is not available on this server yet (HTTP 404).');
 assert.equal(readBaselineGenerateRefusal({status:409,data:{code:'over_size'}}),'The draft could not be generated (over_size).');
 assert.equal(readBaselineGenerateRefusal({status:404,data:'404 page not found'}),'Draft generation is not available on this server yet (HTTP 404).','a router 404 body does not hide the missing route');
 assert.equal(readBaselineGenerateRefusal({status:500,data:{message:'gateway unavailable',code:'E_UPSTREAM'}}),'gateway unavailable (E_UPSTREAM, HTTP 500).');
 assert.equal(readBaselineGenerateRefusal({status:503,data:{message:'try later'}}),'try later (HTTP 503).');
});

test('an unusable draft keeps the blockers and warnings and reports why',()=>{
 const value=readBaselineGenerate({draft:{accounts:[]},blockers:[{code:'account_not_quiescent',subject:'1001',message:'close it'}],warnings:[{code:'case_duplicate_group_names',message:'dup'}],summary:{accounts:0}});
 assert.equal(value.text,'');
 assert.match(value.draftError,/cannot be used: The policy must include the broker accounts/);
 assert.equal(value.blockers.length,1);
 assert.equal(value.warnings.length,1);
 assert.equal(readBaselineGenerate({draft,blockers:[],warnings:[]}).draftError,'');
});

test('missing blocker or warning lists read as empty, a malformed one is refused',()=>{
 const value=readBaselineGenerate({draft,blockers:null,warnings:undefined});
 assert.ok(value.text);
 assert.deepEqual([value.blockers,value.warnings],[[],[]]);
});
