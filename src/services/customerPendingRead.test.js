import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {validateCustomerPendingPage,nativePendingLabels} from './customerPendingRead.js';
const row={execution_owner:'lp_native',command_id:'9007199254740993',client_order_id:'original',order_ticket:null,revision:'9007199254740994',symbol:'XAUUSD',order_type:'buy_limit',raw_customer_volume:'100.000000000000000001',customer_lots:'0.01',customer_price:'2000.000000000000000001',expiry:null,customer_status:'pending',display_state:'native_full_awaiting_settlement',reconciliation_required:false,controls_available:false};
test('exact customer values and redaction; no native fill inference',()=>{
const page=validateCustomerPendingPage({orders:[{...row,upstream_account:'private',target_wire_qty:'200'}],truncated:true});
assert.equal(page.orders[0].command_id,row.command_id);assert.equal(page.orders[0].customer_price,row.customer_price);assert.equal(page.orders[0].controls_available,false);assert.equal(page.orders[0].target_wire_qty,undefined);assert.match(nativePendingLabels[page.orders[0].display_state],/awaiting customer/);
});
test('reject malformed ownership, conflicting fill, mutation enablement and duplicates',()=>{
for(const patch of [{execution_owner:'internal_fix'},{command_id:42},{controls_available:true},{order_ticket:'0'},{customer_status:'filled'},{customer_price:2000},{expiry:253402300800},{display_state:'filled'}])assert.throws(()=>validateCustomerPendingPage({orders:[{...row,...patch}],truncated:false}));
assert.throws(()=>validateCustomerPendingPage({orders:[row,row],truncated:false}));
});


test('completed customer rejection and expiry labels do not claim native terminal outcomes',()=>{
 assert.equal(nativePendingLabels.rejected,'Customer rejected');
 assert.equal(nativePendingLabels.expired,'Customer expired');
 for(const display_state of ['rejected','expired']){
  const page=validateCustomerPendingPage({orders:[{...row,display_state,customer_status:'rejected',order_ticket:null}],truncated:false});
  assert.equal(page.orders[0].order_ticket,null);
  assert.equal(page.orders[0].customer_lots,row.customer_lots);
 }
});
test('durable customer cancellation retains the placement ticket',()=>{
 assert.equal(nativePendingLabels.cancelled,'Customer cancelled');
 const page=validateCustomerPendingPage({orders:[{...row,display_state:'cancelled',customer_status:'rejected',order_ticket:'9007199254740995'}],truncated:false});
 assert.equal(page.orders[0].order_ticket,'9007199254740995');
 assert.equal(page.orders[0].controls_available,false);
});

test('cancel availability is additive, strict and never generic control authority',()=>{
 assert.equal(validateCustomerPendingPage({orders:[row],truncated:false}).orders[0].cancel_available,false);
 const allowed=validateCustomerPendingPage({orders:[{...row,order_ticket:'9007199254740995',cancel_available:true}],truncated:false}).orders[0];
 assert.equal(allowed.cancel_available,true);assert.equal(allowed.controls_available,false);
 for(const cancel_available of [null,1,'true',{}])assert.throws(()=>validateCustomerPendingPage({orders:[{...row,cancel_available}],truncated:false}));
});