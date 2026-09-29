import test from 'node:test';
import assert from 'node:assert/strict';
import {planExactDemoSplit,readExactDemoSizing,validateExactDemoEvidence,exactDemoCoverage,checkExactDemoSplitRenewal,EXACT_DEMO_UNVERIFIED_GRID_BASIS,expectedUnverifiedUnitsPerLot} from './lpExactDemoSizing.js';
const now=Date.parse('2026-09-28T12:00:00Z');
const contract=(coverage='50')=>({provider_grid_unverified:true,grid_basis:EXACT_DEMO_UNVERIFIED_GRID_BASIS,contract_id:'xau-expected-wire',min_lots:'0.01',step_lots:'0.01',max_lots:'100',grid_origin_lots:'0',coverage_percent:coverage});
const sizing=(customer='0.02',units='100')=>{const {split,wire_quantity}=planExactDemoSplit(customer,units,contract());return {id:'operator-run',tenant_id:'broker',broker_id:'broker',account_id:'12345678-1234-1234-1234-123456789abc',account_login:'200002',connection_id:'demo',connection_revision:'2',symbol:'XAUUSD',provider_symbol_id:'41',mapping_version:'map',customer_lots:customer,wire_quantity,units_per_lot:units,authorized_at:'2026-09-28T11:59:00Z',opening_valid_until:'2026-09-28T12:20:00Z',hybrid_split:split};};
test('expected unverified wire per 0.01 lot for the three symbols',()=>{
 assert.deepEqual({...expectedUnverifiedUnitsPerLot},{XAUUSD:'100',EURUSD:'100000',BTCUSD:'1'});
 for(const [units,wire] of [['100','1'],['100000','1000'],['1','0.01']]){const out=planExactDemoSplit('0.02',units,contract());assert.equal(out.wire_quantity,wire);assert.equal(out.split.external_lots,'0.01');assert.equal(out.split.b_book_lots,'0.01');assert.equal(out.split.excess_lots,'0');assert.equal(out.split.provider_grid_unverified,true);}
});
test('upward rounding of the external leg matches the backend planner',()=>{
 for(const [c,cov,req,ext,bb] of [['0.03','50','0.015','0.02','0.01'],['0.05','50','0.025','0.03','0.02'],['0.1','25','0.025','0.03','0.07'],['0.02','10','0.002','0.01','0.01']]){const {split}=planExactDemoSplit(c,'1',contract(cov));assert.deepEqual([split.requested_lp_lots,split.external_lots,split.b_book_lots],[req,ext,bb]);}
});
test('split refuses min/step/max, excess and collapsed or unflagged contracts',()=>{
 const bad=[['0.02','1',{provider_grid_unverified:false}],['0.02','1',{grid_basis:'provider_demo'}],['0.02','1',{contract_id:''}],['0.02','1',{coverage_percent:'100'}],['0.02','1',{coverage_percent:'150'}],['0.02','1',{coverage_percent:'0'}],['0.015','1',{}],['0.005','1',{}],['0.04','1',{max_lots:'0.01'}],['0.02','1',{step_lots:'0'}],['0.02','1',{min_lots:'0.010'}],['0.02','0.1',{}],['0.01','1',{}]];
 for(const [c,u,patch] of bad)assert.throws(()=>planExactDemoSplit(c,u,{...contract(),...patch}),/Hybrid split refused/);
});
test('saved hybrid sizing must equal its recomputation and keeps the unverified label',()=>{
 const v=sizing();
 const out=readExactDemoSizing(v,{account_login:'200002'},now);
 assert.deepEqual(out,v);
 assert.deepEqual(exactDemoCoverage(out),{customer_lots:'0.02',lp_requested_lots:'0.01',internal_lots:'0.01',broker_excess_lots:'0'});
 for(const patch of [{wire_quantity:'2'},{units_per_lot:'1'},{hybrid_split:{...v.hybrid_split,b_book_lots:'0.02'}},{hybrid_split:{...v.hybrid_split,provider_grid_unverified:false}},{hybrid_split:{...v.hybrid_split,extra:'x'}},{hybrid_split:{...v.hybrid_split,external_lots:'0.02'}}])assert.throws(()=>readExactDemoSizing({...v,...patch},{},now));
 const e={exact_demo_sizing:v,connection_id:'demo',connection_revision:'2',symbol:'XAUUSD',account_mode:'hedging',trade:{provider:'cserver',environment:'demo',provider_symbol_id:'41',symbol_mapping_version:'map'},quote:{environment:'demo'},grid:{verified:false,evidence_id:'',min_lots:'',max_lots:'',step_lots:'',grid_origin_lots:'',units_per_lot:''},verified_at:v.authorized_at,valid_until:v.opening_valid_until};
 assert.deepEqual(validateExactDemoEvidence(e,now),v);
 assert.throws(()=>validateExactDemoEvidence({...e,grid:{...e.grid,min_lots:'0.01'}},now));
 assert.throws(()=>validateExactDemoEvidence({...e,grid:{...e.grid,verified:true}},now));
});
test('fixed 100% exact authority is unchanged',()=>{
 const {hybrid_split,...fixed}=sizing();void hybrid_split;
 const legacy={...fixed,customer_lots:'0.01',wire_quantity:'1'};
 assert.deepEqual(readExactDemoSizing(legacy,{},now),legacy);
 assert.deepEqual(exactDemoCoverage(legacy),{customer_lots:'0.01',lp_requested_lots:'0.01',internal_lots:'0',broker_excess_lots:'0'});
 assert.throws(()=>readExactDemoSizing({...legacy,hybrid_split:{}},{},now));
});
test('same-contract renewal keeps grid, conversion and scope',()=>{
 const previous=sizing(),next={...sizing('0.04'),authorized_at:'2026-09-28T12:05:00Z'};
 checkExactDemoSplitRenewal(previous,next);
 assert.throws(()=>checkExactDemoSplitRenewal(previous,{...next,units_per_lot:'1'}));
 assert.throws(()=>checkExactDemoSplitRenewal(previous,{...next,hybrid_split:{...next.hybrid_split,step_lots:'0.02'}}));
 assert.throws(()=>checkExactDemoSplitRenewal(previous,{...next,authorized_at:'2026-09-28T11:00:00Z'}));
 checkExactDemoSplitRenewal(previous,{...next,hybrid_split:{...next.hybrid_split,contract_id:'new-contract',step_lots:'0.02'}});
});
