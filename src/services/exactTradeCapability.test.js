import test from 'node:test';
import assert from 'node:assert/strict';
import {pendingModifyAllowed,protectionAllowed,legacyPendingModifyAllowed,legacyProtectionAllowed,pendingModifyPath,protectionPath,createPendingModifyRouter,validateExactPendingRow,validateExactPositionRow,pendingReadbackMatches,protectionReadbackMatches,closeVolumeError,createExactTradeReader,decimalEqual,rowReadRouteAbsent} from './exactTradeCapability.js';

const TICKET='9007199254740993';
const pending=(patch={})=>({ticket_text:TICKET,account_login:1001,symbol:'BTCUSD',type:'buy_limit',price_decimal:'65000.50',state_version:'7',exact_modify_available:true,time_expiry:null,...patch});
const position=(patch={})=>({position_ticket_text:TICKET,account_login:'1001',symbol:'XAUUSD',exact_protection_available:true,state_version:'4',protection_version:'2',sl_decimal:'1234567890.12345677',tp_decimal:null,...patch});

test('gates need the exact server flag and the trade permission',()=>{
 assert.equal(pendingModifyAllowed({exact_modify_available:true},true),true);
 for(const [row,permitted] of [[{exact_modify_available:true},false],[{exact_modify_available:'true'},true],[{},true],[null,true],[{exact_modify_available:true},undefined]])assert.equal(pendingModifyAllowed(row,permitted),false);
 assert.equal(protectionAllowed({exact_protection_available:true},true),true);
 for(const [row,permitted] of [[{exact_protection_available:true},false],[{exact_protection_available:1},true],[{},true]])assert.equal(protectionAllowed(row,permitted),false);
});

test('pending read keeps exact strings above 2^53 and fails closed on malformed fields',()=>{
 const row=validateExactPendingRow(pending(),{login:1001,ticket:TICKET});
 assert.equal(row.ticket_text,TICKET);assert.equal(row.state_version,'7');assert.equal(row.price_decimal,'65000.50');assert.equal(row.expiry,null);assert.equal(row.exact_modify_available,true);
 assert.equal(validateExactPendingRow({order:pending({time_expiry:1790000000})},{login:'1001',ticket:TICKET}).expiry,1790000000);
 for(const patch of [{ticket_text:Number(TICKET)},{ticket_text:'9007199254740994'},{account_login:1002},{state_version:7},{state_version:'07'},{price_decimal:65000.5},{price_decimal:'0'},{price_decimal:'1e3'},{exact_modify_available:'true'},{exact_modify_available:undefined},{time_expiry:-1},{type:'buy_stop_limit'}])
  assert.throws(()=>validateExactPendingRow(pending(patch),{login:1001,ticket:TICKET}),error=>error.code==='EXACT_READ_UNAVAILABLE',JSON.stringify(patch));
 assert.equal(validateExactPendingRow(pending({type:'buy_stop_limit',exact_modify_available:false}),{login:1001,ticket:TICKET}).exact_modify_available,false);
 assert.throws(()=>validateExactPendingRow(pending(),{login:1001,ticket:Number(TICKET)}));
});

test('position read requires versions as strings and exact nullable levels',()=>{
 const row=validateExactPositionRow(position(),{login:1001,ticket:TICKET});
 assert.equal(row.sl_decimal,'1234567890.12345677');assert.equal(row.tp_decimal,null);assert.equal(row.protection_version,'2');
 assert.equal(validateExactPositionRow(position({tp_decimal:'0'}),{login:1001,ticket:TICKET}).tp_decimal,null);
 assert.equal(validateExactPositionRow({position:position({exact_protection_available:false,sl_decimal:undefined,tp_decimal:undefined})},{login:1001,ticket:TICKET}).exact_protection_available,false);
 for(const patch of [{protection_version:2},{state_version:'0'},{sl_decimal:1234567890.1234567},{sl_decimal:undefined},{tp_decimal:'-1'},{exact_protection_available:null},{position_ticket_text:'1'},{account_login:undefined}])
  assert.throws(()=>validateExactPositionRow(position(patch),{login:1001,ticket:TICKET}),error=>error.code==='EXACT_READ_UNAVAILABLE',JSON.stringify(patch));
});

test('pending readback needs the acknowledged version and the requested exact terms',()=>{
 const row=validateExactPendingRow(pending({state_version:'8',price_decimal:'65001'}),{login:1001,ticket:TICKET});
 assert.equal(pendingReadbackMatches(row,{state_version:'8',price_decimal:'65001.000'},{price:'65001.0',expiry:null}),true);
 assert.equal(pendingReadbackMatches(row,{state_version:'9'},{price:'65001'}),false);
 assert.equal(pendingReadbackMatches(row,{state_version:8},{price:'65001'}),false);
 assert.equal(pendingReadbackMatches(row,{state_version:'8'},{price:'65001.5'}),false);
 assert.equal(pendingReadbackMatches(row,{state_version:'8'},{expiry:1790000000}),false);
 assert.equal(pendingReadbackMatches(null,{state_version:'8'},{}),false);
});

test('protection readback compares versions and decimals that float64 would round',()=>{
 const row=validateExactPositionRow(position({state_version:'5',protection_version:'3'}),{login:1001,ticket:TICKET});
 const ack={state_version:'5',protection_version:'3'};
 assert.equal(protectionReadbackMatches(row,ack,{sl:'1234567890.12345677',tp:null}),true);
 assert.equal(protectionReadbackMatches(row,ack,{sl:'1234567890.12345678'}),false);
 assert.equal(protectionReadbackMatches(row,ack,{tp:'0'}),true);
 assert.equal(protectionReadbackMatches(row,ack,{tp:'1'}),false);
 assert.equal(protectionReadbackMatches(row,{...ack,protection_version:'4'},{}),false);
 assert.equal(protectionReadbackMatches(row,{...ack,state_version:5},{}),false);
 assert.equal(decimalEqual('1.10','1.1'),true);assert.equal(decimalEqual('x','x'),false);
});

test('partial close keeps the grid and a remainder of zero or at least the minimum lot',()=>{
 const spec={current:'1.00',min:'0.01',step:'0.01'};
 assert.equal(closeVolumeError('0',spec),'');assert.equal(closeVolumeError('1',spec),'');assert.equal(closeVolumeError('0.5',spec),'');
 assert.match(closeVolumeError('1.01',spec),/exceed/);assert.match(closeVolumeError('0.005',spec),/multiple/);
 assert.match(closeVolumeError('0.995',{current:'1',min:'0.01',step:'0.005'}),/remaining position would be below/);
 assert.match(closeVolumeError('0.05',{current:'1',min:'0.1'}),/below the minimum/);
 assert.equal(closeVolumeError('0.05',{current:'0.05',min:'0.1'}),'');
 for(const bad of ['','-1','1e-2','abc','0.0'])assert.match(closeVolumeError(bad,spec),/exact decimal/);
 assert.equal(closeVolumeError('0.3',{}),'');
});

test('reader uses the account-scoped single-row path and fails closed',async()=>{
 const paths=[];const reader=createExactTradeReader({request:async path=>{paths.push(path);return path.includes('pending-orders')?pending():position();}});
 assert.equal((await reader.readPending(1001,TICKET)).ticket_text,TICKET);assert.equal((await reader.readPosition('1001',TICKET)).position_ticket_text,TICKET);
 assert.deepEqual(paths,['/api/v1/manager/accounts/1001/pending-orders/'+TICKET,'/api/v1/manager/accounts/1001/positions/'+TICKET]);
 const missing=createExactTradeReader({request:async()=>{throw Object.assign(new Error('404'),{status:404,body:{error:'PENDING_ORDER_NOT_FOUND'}});}});
 await assert.rejects(missing.readPending(1001,TICKET),error=>error.code==='EXACT_READ_UNAVAILABLE');
 const foreign=createExactTradeReader({request:async()=>pending({ticket_text:'1'})});
 await assert.rejects(foreign.readPending(1001,TICKET),error=>error.code==='EXACT_READ_UNAVAILABLE');
 await assert.rejects(reader.readPending(0,TICKET),error=>error.code==='EXACT_READ_UNAVAILABLE');
 assert.throws(()=>createExactTradeReader({}));
});

test('legacy rows get the legacy path only from an explicit server flag; exact wins and both is malformed',()=>{
 const legacyRow=validateExactPendingRow(pending({exact_modify_available:false,legacy_modify_available:true,type:'buy_stop_limit',sl_decimal:'1.20',tp_decimal:'0'}),{login:1001,ticket:TICKET});
 assert.equal(legacyRow.legacy_modify_available,true);assert.equal(legacyRow.sl_decimal,'1.20');assert.equal(legacyRow.tp_decimal,null);
 assert.equal(pendingModifyPath(legacyRow,true),'legacy');assert.equal(pendingModifyPath(legacyRow,false),null);assert.equal(pendingModifyAllowed(legacyRow,true),false);assert.equal(legacyPendingModifyAllowed(legacyRow,true),true);
 assert.equal(pendingModifyPath(validateExactPendingRow(pending(),{login:1001,ticket:TICKET}),true),'exact');
 const hidden=validateExactPendingRow(pending({exact_modify_available:false}),{login:1001,ticket:TICKET});
 assert.equal(hidden.legacy_modify_available,false);assert.equal(pendingModifyPath(hidden,true),null);
 for(const patch of [{legacy_modify_available:true},{exact_modify_available:false,legacy_modify_available:'true'},{exact_modify_available:false,legacy_modify_available:null},{sl_decimal:1.2},{tp_decimal:'-1'}])
  assert.throws(()=>validateExactPendingRow(pending(patch),{login:1001,ticket:TICKET}),error=>error.code==='EXACT_READ_UNAVAILABLE',JSON.stringify(patch));
 assert.equal(legacyPendingModifyAllowed({legacy_modify_available:true,exact_modify_available:true},true),false);
 const legacyPosition=validateExactPositionRow(position({exact_protection_available:false,legacy_protection_available:true,protection_version:'0'}),{login:1001,ticket:TICKET});
 assert.equal(protectionPath(legacyPosition,true),'legacy');assert.equal(protectionPath(legacyPosition,false),null);assert.equal(protectionAllowed(legacyPosition,true),false);assert.equal(legacyProtectionAllowed(legacyPosition,true),true);
 assert.equal(protectionPath(validateExactPositionRow(position(),{login:1001,ticket:TICKET}),true),'exact');
 assert.equal(protectionPath(validateExactPositionRow(position({exact_protection_available:false}),{login:1001,ticket:TICKET}),true),null);
 for(const patch of [{legacy_protection_available:true},{exact_protection_available:false,legacy_protection_available:1},{protection_version:'00'},{protection_version:'-0'}])
  assert.throws(()=>validateExactPositionRow(position(patch),{login:1001,ticket:TICKET}),error=>error.code==='EXACT_READ_UNAVAILABLE',JSON.stringify(patch));
});

test('inline pending edits route legacy rows without a version and exact rows through the versioned readback path',async()=>{
 const rows=[],calls=[];let serve=()=>rows.shift();
 const reader=createExactTradeReader({request:async()=>serve()});
 const route=createPendingModifyRouter({reader,modifyExact:async(ticket,input)=>{calls.push(['exact',ticket,input]);return {client_order_id:'c1',awaiting_readback:true,state_version:'8',price_decimal:'65001',checkStatus:()=>'status'};},modifyLegacy:async(ticket,input)=>{calls.push(['legacy',ticket,input]);return {ok:true};}});
 rows.push(pending({exact_modify_available:false,legacy_modify_available:true}));
 assert.deepEqual(await route({ticket:TICKET,login:1001,stoploss:'1.1'}),{ok:true});
 assert.deepEqual(calls.at(-1),['legacy',TICKET,{stoploss:'1.1',account_login:1001}]);
 rows.push(pending(),pending({state_version:'8',price_decimal:'65001'}));
 const done=await route({ticket:TICKET,account_login:1001,price:'65001'});assert.equal(done.confirmed,true);
 assert.deepEqual(calls.at(-1),['exact',TICKET,{account_login:1001,expected_version:'7',price:'65001'}]);
 rows.push(pending(),pending({state_version:'7'}));
 await assert.rejects(route({ticket:TICKET,account_login:1001,price:'65001'}),error=>error.code==='MODIFY_READBACK_UNCONFIRMED'&&error.statusUnknown&&error.checkStatus()==='status');
 const before=calls.length;
 rows.push(pending());await assert.rejects(route({ticket:TICKET,account_login:1001,stoploss:'1'}),error=>error.code==='EXACT_PENDING_UNSUPPORTED');
 rows.push(pending());await assert.rejects(route({ticket:TICKET,account_login:1001,price:'65000.5'}),error=>error.code==='NO_CHANGE');
 rows.push(pending({exact_modify_available:false}));await assert.rejects(route({ticket:TICKET,account_login:1001,price:'1'}),error=>error.code==='MODIFY_UNAVAILABLE');
 rows.push(pending({exact_modify_available:false,legacy_modify_available:true}));await assert.rejects(route({ticket:TICKET,account_login:1001,price:'1'},{permitted:false}),error=>error.code==='MODIFY_UNAVAILABLE');
 serve=()=>{throw Object.assign(new Error('404'),{status:404,body:{error:'PENDING_ORDER_NOT_FOUND'}});};await assert.rejects(route({ticket:TICKET,account_login:1001,price:'1'}),error=>error.code==='EXACT_READ_UNAVAILABLE');
 assert.equal(calls.length,before);
 assert.throws(()=>createPendingModifyRouter({reader,modifyExact:()=>{}}));
});

// Route-absent fallback: a Manager binary without the B1-M/B3-M reads.
const routeMissing=(status=404,body='404 page not found\n')=>Object.assign(new Error('HTTP '+status),{status,body});

test('only a 405 or a 404 without a JSON error code counts as the row-read route being absent',()=>{
 for(const error of [routeMissing(),routeMissing(404,null),routeMissing(404,''),routeMissing(405,''),{response:{status:404,data:'404 page not found\n'}},{response:{status:405,data:''}},routeMissing(404,{})])
  assert.equal(rowReadRouteAbsent(error),true,JSON.stringify(error));
 for(const error of [routeMissing(404,{error:'PENDING_ORDER_NOT_FOUND'}),routeMissing(404,{error:'POSITION_NOT_FOUND'}),{response:{status:404,data:{error:'POSITION_NOT_FOUND'}}},routeMissing(404,{code:'X'}),
  routeMissing(401,''),routeMissing(403,{error:'PENDING_ORDER_READ_UNAVAILABLE'}),routeMissing(500,''),routeMissing(502,''),routeMissing(503,{error:'POSITION_READ_UNAVAILABLE'}),{response:{status:403,data:''}},new Error('Network Error'),null,undefined,{status:'404'}])
  assert.equal(rowReadRouteAbsent(error),false,JSON.stringify(error));
});

test('a route-absent read falls back to the pre-A5 legacy path once per session and route, and is reported once',async()=>{
 const paths=[],reports=[];let answer=path=>{throw routeMissing(path.includes('positions')?405:404);};
 const reader=createExactTradeReader({request:async path=>{paths.push(path);return answer(path);},onRouteAbsent:report=>{reports.push(report);throw new Error('logging failure is ignored');}});
 const row=await reader.readPending(1001,TICKET);
 assert.equal(row.legacy_fallback,true);assert.equal(row.ticket_text,TICKET);assert.equal(row.account_login,'1001');assert.ok(Object.isFrozen(row));
 assert.equal(row.state_version,undefined);assert.equal(row.price_decimal,undefined);assert.equal(row.sl_decimal,undefined);assert.equal(row.expiry,undefined);
 assert.equal(pendingModifyPath(row,true),'legacy');assert.equal(pendingModifyPath(row,false),null);assert.equal(pendingModifyAllowed(row,true),false);
 assert.equal(decimalEqual('1.1',row.price_decimal),false);
 answer=()=>pending();
 assert.equal((await reader.readPending(1001,'42')).legacy_fallback,true,'cached: no further pending read');
 assert.equal(paths.length,1);assert.equal(reader.routeAbsent('pending-orders'),true);assert.equal(reader.routeAbsent('positions'),false);
 await assert.rejects(reader.readPending(0,TICKET),error=>error.code==='EXACT_READ_UNAVAILABLE');
 answer=path=>{throw routeMissing(path.includes('positions')?405:404);};
 const position=await reader.readPosition('1001',TICKET);
 assert.equal(position.legacy_fallback,true);assert.equal(position.position_ticket_text,TICKET);assert.equal(position.protection_version,undefined);
 assert.equal(protectionPath(position,true),'legacy');assert.equal(protectionPath(position,false),null);assert.equal(protectionAllowed(position,true),false);
 await reader.readPosition('1001',TICKET);assert.equal(paths.length,2);
 assert.deepEqual(reports,[{kind:'pending-orders',status:404},{kind:'positions',status:405}]);
});

test('401, 403, 5xx, network and the new route own 404 stay fail-closed and are not cached',async()=>{
 const errors=[routeMissing(401,''),routeMissing(403,{error:'PENDING_ORDER_READ_UNAVAILABLE'}),routeMissing(500,''),routeMissing(503,{error:'PENDING_ORDER_READ_UNAVAILABLE'}),
  routeMissing(404,{error:'PENDING_ORDER_NOT_FOUND'}),{response:{status:404,data:{error:'PENDING_ORDER_NOT_FOUND'}}},new TypeError('Failed to fetch')];
 let calls=0,reports=0;const reader=createExactTradeReader({request:async()=>{throw errors[calls++];},onRouteAbsent:()=>reports++});
 for(let i=0;i<errors.length;i++)await assert.rejects(reader.readPending(1001,TICKET),error=>error.code==='EXACT_READ_UNAVAILABLE');
 assert.equal(calls,errors.length);assert.equal(reports,0);assert.equal(reader.routeAbsent('pending-orders'),false);
 const aborted=createExactTradeReader({request:async()=>{throw Object.assign(new Error('aborted'),{name:'AbortError',status:404});}});
 await assert.rejects(aborted.readPending(1001,TICKET),error=>error.name==='AbortError');assert.equal(aborted.routeAbsent('pending-orders'),false);
});

test('inline pending edits on a route-absent fallback row use the legacy command without a version',async()=>{
 const calls=[];const reader=createExactTradeReader({request:async()=>{throw routeMissing();}});
 const route=createPendingModifyRouter({reader,modifyExact:async(...args)=>{calls.push(['exact',...args]);},modifyLegacy:async(ticket,input)=>{calls.push(['legacy',ticket,input]);return {ok:true};}});
 assert.deepEqual(await route({ticket:TICKET,login:1001,stoploss:'1.1',price:'65000.5'}),{ok:true});
 assert.deepEqual(calls,[['legacy',TICKET,{stoploss:'1.1',price:'65000.5',account_login:1001}]]);
 await assert.rejects(route({ticket:TICKET,account_login:1001,price:'1'},{permitted:false}),error=>error.code==='MODIFY_UNAVAILABLE');
 assert.equal(calls.length,1);
});
