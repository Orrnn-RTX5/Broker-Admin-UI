import test from 'node:test';
import assert from 'node:assert/strict';
import {demoMarketDraft,readDemoMarketPreview,demoMarketCommand,demoPreviewCurrent} from './lpDemoMarket.js';
const draft={account_login:1001,symbol:'EURUSD',side:'buy',volume:'0.01',execution_policy:'IOC'};
function preview(){
 const scope={draft_fingerprint:'a'.repeat(64),account_id:'account',group_id:'demo',connection_id:'venue',rule_id:'rule',feed_source_kind:'account',feed_source_group:'demo',connection_revision:'9007199254740993',rule_version:'1',evidence_revision:'3',feed_source_revision:'0',account_selection_revision:'1',selection_revision:'1',grant_revision:'2'};
 return {ready:true,draft,draft_fingerprint:scope.draft_fingerprint,scope,evaluated_at:'2026-09-27T12:00:00Z',valid_until:'2026-09-27T12:00:15Z',marker:{version:'lp_demo_market_v1',scope,valid_until:'2026-09-27T12:00:15Z'},coverage:{mode:'volume',customer_lots:'0.01',lp_requested_lots:'0.02',internal_lots:'0',broker_excess_lots:'0.01'}};
}
test('demo draft rejects precision loss and preserves valid small quantities',()=>{
 assert.equal(demoMarketDraft({...draft,volume:'0.00000001'}).volume,'0.00000001');
 assert.equal(demoMarketDraft({...draft,volume:'0.0100'}).volume,'0.01');
 for(const volume of ['0','0.010000000000000001','1e-2','-1','NaN'])assert.throws(()=>demoMarketDraft({...draft,volume}));
 assert.throws(()=>demoMarketDraft({...draft,account_login:9007199254740992}));
});
test('demo preview binds exact draft, allocation, revision and expiry before canonical WS payload',()=>{
 const value=readDemoMarketPreview(preview(),draft),now=Date.parse('2026-09-27T12:00:01Z');
 const command=demoMarketCommand(value,now);assert.equal(command.volume,.01);assert.equal(command.lp_demo_test.scope.connection_revision,'9007199254740993');assert.equal(command.execution_policy,'IOC');assert.equal(value.coverage.broker_excess_lots,'0.01');
 assert.equal(demoPreviewCurrent(value,Date.parse(value.valid_until)),false);assert.throws(()=>demoMarketCommand(value,Date.parse(value.valid_until)));
 assert.throws(()=>readDemoMarketPreview(preview(),{...draft,side:'sell'}));
 const wrong=preview();wrong.marker={...wrong.marker,scope:{...wrong.scope,grant_revision:'3'}};assert.throws(()=>readDemoMarketPreview(wrong,draft));
 const missing=preview();delete missing.coverage.broker_excess_lots;assert.throws(()=>readDemoMarketPreview(missing,draft));
 assert.deepEqual(readDemoMarketPreview({ready:false,reason:'LP_DEMO_FORBIDDEN',marker:preview().marker},draft),{ready:false,reason:'LP_DEMO_FORBIDDEN'});
});

test('exact-demo preview binds selected account and exact allocation; submission retains original marker',()=>{
 const v=preview();v.scope.account_id='12345678-1234-1234-1234-123456789abc';v.marker.scope=v.scope;v.coverage.lp_requested_lots='0.01';v.coverage.broker_excess_lots='0';
 v.exact_demo_sizing={id:'run',tenant_id:'broker',broker_id:'broker',account_id:v.scope.account_id,account_login:String(draft.account_login),connection_id:v.scope.connection_id,connection_revision:v.scope.connection_revision,symbol:draft.symbol,provider_symbol_id:'1',mapping_version:'map',customer_lots:'0.01',wire_quantity:'0.01',units_per_lot:'1',authorized_at:v.evaluated_at,opening_valid_until:v.valid_until};
 const out=readDemoMarketPreview(v,draft);assert.equal(out.exact_demo_sizing.wire_quantity,'0.01');assert.deepEqual(demoMarketCommand(out,Date.parse(v.evaluated_at)+1).lp_demo_test,v.marker);
 for(const patch of [{account_login:'999'},{customer_lots:'0.02',wire_quantity:'0.02'},{connection_revision:'2'},{opening_valid_until:v.evaluated_at}])assert.throws(()=>readDemoMarketPreview({...v,exact_demo_sizing:{...v.exact_demo_sizing,...patch}},draft));
 for(const patch of [{lp_requested_lots:'0.02'},{internal_lots:'0.01'},{broker_excess_lots:'0.01'}])assert.throws(()=>readDemoMarketPreview({...v,coverage:{...v.coverage,...patch}},draft));
 assert.throws(()=>demoMarketCommand(out,Date.parse(v.valid_until)));
});
