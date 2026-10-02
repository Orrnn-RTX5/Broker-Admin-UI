import test from 'node:test';import assert from 'node:assert/strict';import {createManagerTradeSocket,exactTradeTicket} from './managerTradeSocket.js';
const demoMarker=()=>({version:'lp_demo_market_v1',valid_until:'2026-01-01T00:00:00Z',scope:{draft_fingerprint:'a'.repeat(64),account_id:'account-one',group_id:'demo',connection_id:'venue',rule_id:'rule',feed_source_kind:'account',feed_source_group:'demo',connection_revision:'9007199254740993',rule_version:'1',evidence_revision:'3',feed_source_revision:'0',account_selection_revision:'1',selection_revision:'1',grant_revision:'2'}});
test('demo marker survives reload and expired-preview recovery without another placement',async()=>{
 const input={account_login:1001,symbol:'EURUSD',side:'buy',volume:.01,execution_policy:'IOC',lp_demo_test:demoMarker(),client_order_id:ID},f=fixture({deadlineMs:35});
 const until=async(predicate,label)=>{for(let i=0;i<100;i++){if(predicate())return;await Promise.resolve();}assert.ok(predicate(),label);};
 const first=f.client.place(input),lost=assert.rejects(first,error=>error.statusUnknown);
 await until(()=>f.sockets.length===1,'placement socket was created');f.sockets[0].open();
 await until(()=>f.sockets[0].sent.length===1,'placement frame was sent');
 const sent=f.sockets[0].sent[0];assert.deepEqual(sent.lp_demo_test,input.lp_demo_test);input.lp_demo_test.scope.grant_revision='999';assert.equal(sent.lp_demo_test.scope.grant_revision,'2');await lost;
 const replacement=createManagerTradeSocket({...f.settings,deadlineMs:500}),before=f.settings.storage.getItem('rtx5.manager-ws-commands.v1');
 assert.equal(replacement.listDemos(1001)[0].client_order_id,ID);assert.equal(replacement.listDemos(1001)[0].lp_demo_test.scope.connection_revision,'9007199254740993');assert.deepEqual(replacement.listDemos(1002),[]);assert.equal(f.settings.storage.getItem('rtx5.manager-ws-commands.v1'),before);
 assert.throws(()=>replacement.place(input),/original demo command/);f.scope('other');assert.deepEqual(replacement.listDemos(1001),[]);f.scope('manager-a');
 const priorSockets=f.sockets.length,recovery=replacement.recoverDemo(1001,ID);await until(()=>f.sockets.length===priorSockets+1,'recovery socket was created');const socket=f.sockets.at(-1);socket.open();await until(()=>socket.sent.length===1,'recovery query was sent');assert.equal(socket.sent[0].action,'get_order_status');assert.equal(socket.sent[0].client_order_id,ID);socket.emit(filled(socket.sent[0]));await recovery;
 assert.deepEqual(replacement.listDemos(1001),[]);assert.equal(f.sockets.flatMap(s=>s.sent).filter(x=>x.action==='place_order').length,1);
});
test('demo refuses lost storage or malformed marker before transport',()=>{
 const input={account_login:1001,symbol:'EURUSD',side:'buy',volume:.01,lp_demo_test:demoMarker()};
 const f=fixture({storage:{getItem:()=>null,setItem:()=>{throw Error('blocked');}}});assert.throws(()=>f.client.place(input),/blocked/);assert.equal(f.sockets.length,0);
 const corrupt=fixture();corrupt.settings.storage.setItem('rtx5.manager-ws-commands.v1','{bad');assert.throws(()=>corrupt.client.place(input));assert.equal(corrupt.sockets.length,0);
 for(const marker of [null,{}, {...demoMarker(),admin:true},{...demoMarker(),scope:{...demoMarker().scope,connection_revision:9007199254740992}}]){const bad=fixture();assert.throws(()=>bad.client.place({...input,lp_demo_test:marker}),/valid demo preview/);assert.equal(bad.sockets.length,0);}
 const close=fixture();assert.throws(()=>close.client.close({...input,position_ticket:TICKET}),/only valid for market/);
});

test('native-only placement intent survives durable reload and cannot be relaxed on the original ID',async()=>{
 const input={account_login:1001,symbol:'EURUSD',type:'buy_limit',volume:'1',price:'1',require_native:true,client_order_id:ID},f=fixture({deadlineMs:30});
 const first=f.client.placePending(input),lost=assert.rejects(first,error=>error.statusUnknown);await tick();f.sockets[0].open();assert.equal(f.sockets[0].sent[0].require_native,true);await lost;
 const replacement=createManagerTradeSocket({...f.settings,deadlineMs:500});
 assert.equal(replacement.listPlacements(1001)[0].require_native,true);
 assert.throws(()=>replacement.placePending({...input,require_native:false}),/another request/);
 const without={...input};delete without.require_native;assert.throws(()=>replacement.placePending(without),/another request/);
 const recovered=replacement.recoverPlacement(1001,ID);await tick();const socket=f.sockets.at(-1);socket.open();assert.equal(socket.sent[0].action,'get_order_status');
 socket.emit({...socket.sent[0],type:'pending_order_placed',status:'succeeded',data:{ticket_text:TICKET,status:'pending',account_login:1001}});await recovered;
 for(const value of ['true',1,null,[]])assert.throws(()=>replacement.placePending({...input,require_native:value}),/native placement requirement/);
 const raw=f.settings.storage.getItem('rtx5.manager-ws-commands.v1');assert.equal(raw,'{}');
});

test('placement discovery refuses coercible malformed stored identities and wire values',()=>{
 const f=fixture(),action='place_pending_order',payload={account_login:1001,symbol:'EURUSD',type:'buy_limit',volume:'1.000000000000000001',price:'1.123456789012345678',sl:null,expiry:null};
 const signature=JSON.stringify({action,payload}),key=JSON.stringify(['manager-a',action,signature]);
 const original={id:ID,scope:'manager-a',action,payload,signature,sent:false};
 const store=record=>f.settings.storage.setItem('rtx5.manager-ws-commands.v1',JSON.stringify({[key]:record}));
 store(original);assert.deepEqual(f.client.listPlacements(1001),[{...payload,client_order_id:ID}]);
 for(const patch of [
  {id:[ID]},{id:{value:ID}},{signature:[signature]},{payload:[]},
  {payload:{...payload,account_login:'1001'}},{payload:{...payload,volume:1}},
  {payload:{...payload,price:1.1234567890123457}},{payload:{...payload,symbol:' eurusd '}},
  {payload:{...payload,type:['buy_limit']}},{payload:{...payload,type:'BUY_LIMIT'}},
  {payload:{...payload,price:[payload.price]}},{payload:{...payload,extra:'unsent'}}
 ]){
  store({...original,...patch});
  assert.throws(()=>f.client.listPlacements(1001),undefined,JSON.stringify(patch));
  assert.throws(()=>f.client.recoverPlacement(1001,ID),undefined,JSON.stringify(patch));
 }
 assert.equal(f.sockets.length,0);store(original);
 assert.deepEqual(f.client.listPlacements(1001),[{...payload,client_order_id:ID}]);
});

test('placement reload discovery preserves exact terms and only explicit status recovery performs I/O',async()=>{
 const f=fixture({deadlineMs:30}),input={account_login:1001,symbol:'EURUSD',type:'buy_stop',volume:'0.050000000000000001',price:'1.123456789012345678',sl:null,expiry:null,client_order_id:ID};
 const first=f.client.placePending(input),lost=assert.rejects(first,error=>error.statusUnknown);await tick();f.sockets[0].open();await lost;
 const replacement=createManagerTradeSocket({...f.settings,deadlineMs:500}),before=f.settings.storage.getItem('rtx5.manager-ws-commands.v1');
 assert.deepEqual(replacement.listPlacements(1001),[{account_login:1001,symbol:input.symbol,type:input.type,volume:input.volume,price:input.price,sl:null,expiry:null,client_order_id:ID}]);
 assert.deepEqual(replacement.listPlacements(1002),[]);assert.equal(f.sockets.length,1);assert.equal(f.settings.storage.getItem('rtx5.manager-ws-commands.v1'),before);
 f.scope('other');assert.deepEqual(replacement.listPlacements(1001),[]);assert.throws(()=>replacement.recoverPlacement(1001,ID),/Original placement/);f.scope('manager-a');
 const recovered=replacement.recoverPlacement(1001,ID);await tick();const socket=f.sockets.at(-1);socket.open();assert.equal(socket.sent[0].action,'get_order_status');assert.equal(socket.sent[0].client_order_id,ID);
 socket.emit({...socket.sent[0],type:'pending_order_placed',status:'succeeded',data:{ticket_text:TICKET,status:'pending',account_login:1001}});
 assert.equal((await recovered).ticket,TICKET);assert.deepEqual(replacement.listPlacements(1001),[]);
 assert.equal(f.sockets.flatMap(s=>s.sent).filter(row=>row.action==='place_pending_order').length,1);
});

test('placement write ahead refuses corrupt or disabled storage and keeps unknown post-enqueue identity',async()=>{
 const input={account_login:1001,symbol:'EURUSD',type:'buy_limit',volume:'1',price:'1',client_order_id:ID};
 const corrupt=fixture();corrupt.settings.storage.setItem('rtx5.manager-ws-commands.v1','{bad');
 assert.throws(()=>corrupt.client.placePending(input));assert.throws(()=>corrupt.client.listPlacements(1001));assert.equal(corrupt.sockets.length,0);
 const blocked=fixture({storage:{getItem:()=>null,setItem:()=>{throw Error('blocked');}}});assert.throws(()=>blocked.client.placePending(input),/blocked/);assert.equal(blocked.sockets.length,0);
 const f=fixture(),pending=f.client.placePending(input),lost=assert.rejects(pending,error=>error.statusUnknown);
 await tick();const socket=f.sockets[0],send=socket.send;socket.send=function(raw){send.call(this,raw);throw Error('after enqueue');};socket.open();await lost;
 assert.equal(socket.sent[0].action,'place_pending_order');assert.equal(f.client.listPlacements(1001)[0].client_order_id,ID);
 const replacement=createManagerTradeSocket(f.settings),recovery=replacement.recoverPlacement(1001,ID),rejected=assert.rejects(recovery,error=>error.commandStatus==='expired');await tick();
 const next=f.sockets.at(-1);next.open();assert.equal(next.sent.at(-1).action,'get_order_status');next.emit({...next.sent.at(-1),type:'pending_order_rejected',status:'expired',error:{message:'Expired',code:'COMMAND_EXPIRED'}});await rejected;assert.deepEqual(replacement.listPlacements(1001),[]);
});

test('unsent write-ahead placement after reload cannot be resubmitted or replaced',async()=>{
 const f=fixture({requestTicket:async()=>{throw Error('offline');}}),payload={account_login:1001,symbol:'EURUSD',type:'buy_limit',volume:'1',price:'1'};
 const action='place_pending_order',signature=JSON.stringify({action,payload}),key=JSON.stringify(['manager-a',action,signature]);
 const record={id:ID,scope:'manager-a',action,payload,signature,sent:false,durable:true};f.settings.storage.setItem('rtx5.manager-ws-commands.v1',JSON.stringify({[key]:record}));
 const replacement=createManagerTradeSocket(f.settings);
 await assert.rejects(replacement.placePending(payload),error=>error.statusUnknown&&error.client_order_id===ID);
 assert.equal(replacement.listPlacements(1001)[0].client_order_id,ID);
 assert.throws(()=>replacement.placePending({...payload,client_order_id:ID,price:'2'}),/another request/);
 assert.throws(()=>replacement.placePending({...payload,client_order_id:'550e8400-e29b-41d4-a716-446655440001'}),/original command ID/);
 assert.equal(f.sockets.length,0);
});
const ID='550e8400-e29b-41d4-a716-446655440000',TICKET='9007199254740993';
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
function fixture(options={}){
 const sockets=[],values=new Map();let scope='manager-a';const storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
 const settings={storage,requestTicket:async()=>({ticket:'synthetic'}),buildUrl:()=> 'ws://127.0.0.1/fixture',getScope:()=>scope,deadlineMs:500,pollMs:10,...options,createSocket:()=>{
  const socket={readyState:0,sent:[],send(raw){this.sent.push(JSON.parse(raw));},close(){if(this.readyState===3)return;this.readyState=3;this.onclose?.();},open(){if(this.readyState===1)return;this.readyState=1;this.onopen?.();},emit(value){this.onmessage?.({data:JSON.stringify(value)});}};sockets.push(socket);return socket;
 }};
 const client=createManagerTradeSocket(settings);return {client,sockets,settings,scope:value=>{scope=value;}};
}
const filled=(frame,close=false)=>({...frame,type:close?'position_closed':'order_filled',status:close?'succeeded':'filled',data:{account_login:1001,position_ticket_text:TICKET,ticket_text:TICKET,client_order_id:frame.client_order_id}});
test('durable acceptance cannot resolve close; exact ticket and partial lots preserved',async()=>{
 const f=fixture(),promise=f.client.close({account_login:1001,position_ticket:TICKET,volume:.02,client_order_id:ID});let settled=false;promise.then(()=>{settled=true;});await tick();const socket=f.sockets[0];socket.open();const frame=socket.sent[0];
 assert.equal(frame.position_ticket,TICKET);assert.equal(frame.volume,.02);socket.emit({...frame,type:'position_close_accepted',status:'accepted'});await tick();assert.equal(settled,false);
 socket.emit(filled(frame));socket.emit({...filled(frame,true),data:{...filled(frame,true).data,account_login:2002}});await tick();assert.equal(settled,false);
 // Acceptance can legitimately schedule a status poll during the awaited tick.
 // Complete the currently correlated request, not a superseded request ID.
 socket.emit(filled(socket.sent.at(-1),true));assert.equal((await promise).position_ticket_text,TICKET);
});
test('reconnect only queries original ID; no duplicate mutation',async()=>{
 const f=fixture(),promise=f.client.place({login:1001,symbol:'EURUSD',operation:'buy',lots:.05,client_order_id:ID});await tick();f.sockets[0].open();f.sockets[0].close();await tick();const second=f.sockets[1];second.open();assert.equal(second.sent[0].action,'get_order_status');assert.equal(second.sent[0].client_order_id,ID);second.emit(filled(second.sent[0]));await promise;assert.equal(f.sockets.flatMap(s=>s.sent).filter(x=>x.action==='place_order').length,1);
});
test('deadline and client reconstruction retain original close; changed partial quantity is blocked',async()=>{
 const f=fixture({deadlineMs:30});const first=f.client.close({account_login:1001,position_ticket:TICKET,volume:0,client_order_id:ID});const rejection=assert.rejects(first,error=>error.statusUnknown&&error.client_order_id===ID);await tick();f.sockets[0].open();await rejection;
 assert.throws(()=>f.client.close({account_login:1001,position_ticket:TICKET,volume:.01}),/earlier close/);
 const replacement=createManagerTradeSocket({...f.settings,deadlineMs:500});const recovery=replacement.close({account_login:1001,position_ticket:TICKET,volume:0});await tick();const socket=f.sockets.at(-1);socket.open();assert.equal(socket.sent[0].action,'get_order_status');assert.equal(socket.sent[0].client_order_id,ID);socket.emit(filled(socket.sent[0],true));await recovery;
});
test('unsafe numeric ticket rejected before transport',()=>{
 assert.throws(()=>exactTradeTicket(Number(TICKET)));assert.throws(()=>exactTradeTicket('9223372036854775808'));assert.equal(exactTradeTicket(TICKET),TICKET);
});
test('pending exact decimals, accepted versus working and status-only reconnect',async()=>{
 const f=fixture(),promise=f.client.placePending({account_login:1001,symbol:'EURUSD',type:'buy_limit',volume:'0.050000000000000001',price:'1.123456789012345678',expiry:null,client_order_id:ID});let done=false;promise.then(()=>{done=true;});await tick();const first=f.sockets[0];first.open();const frame=first.sent[0];assert.equal(frame.volume,'0.050000000000000001');assert.equal(frame.price,'1.123456789012345678');assert.equal(frame.expiry,null);first.emit({...frame,type:'pending_order_accepted',status:'accepted'});await tick();assert.equal(done,false);first.close();await tick();const second=f.sockets[1];second.open();assert.equal(second.sent[0].action,'get_order_status');second.emit({...second.sent[0],type:'pending_order_placed',status:'succeeded',data:{ticket_text:TICKET,status:'pending',account_login:1001}});assert.equal((await promise).ticket,TICKET);assert.equal(f.sockets.flatMap(s=>s.sent).filter(s=>s.action==='place_pending_order').length,1);
});
test('pending mutation null clear, foreign ticket rejection and cross-action uncertainty lock',async()=>{
 const f=fixture(),promise=f.client.modifyPending({account_login:1001,ticket:TICKET,expected_version:'7',price:'1.123456789012345678',sl:null,client_order_id:ID});await tick();const socket=f.sockets[0];socket.open();const frame=socket.sent[0];assert.equal(frame.sl,null);assert.equal(Object.hasOwn(frame,'tp'),false);assert.throws(()=>f.client.cancelPending({account_login:1001,ticket:TICKET}),/confirmation/);let done=false;promise.then(()=>{done=true;});socket.emit({...frame,type:'pending_order_modified',status:'succeeded',data:{ticket_text:'9007199254740994',status:'modified',account_login:1001}});await tick();assert.equal(done,false);socket.emit({...frame,type:'pending_order_modified',status:'succeeded',data:{ticket_text:TICKET,status:'modified',account_login:1001}});await promise;
 const cancel=f.client.cancelPending({account_login:1001,ticket:TICKET});await tick();const next=f.sockets.at(-1);next.open();const outgoing=next.sent.at(-1);next.emit({...outgoing,type:'pending_order_cancelled',status:'succeeded',data:{ticket_text:TICKET,status:'cancelled',account_login:1001}});assert.equal((await cancel).ticket,TICKET);
 assert.throws(()=>f.client.modifyPending({account_login:1001,ticket:TICKET,volume:'1'}),/cannot change/);assert.throws(()=>f.client.placePending({account_login:1001,type:'buy_stop_limit',symbol:'EURUSD',volume:'1',price:'1'}),/Stop-limit/);
});

test('requested policy survives market transport and unsupported policy fails before send',async()=>{const f=fixture();assert.throws(()=>f.client.place({login:1001,symbol:'EURUSD',operation:'buy',lots:.05,execution_policy:'GTC'}));const result=f.client.place({login:1001,symbol:'EURUSD',operation:'buy',lots:.05,execution_policy:'IOC'});await tick();const socket=f.sockets[0];socket.open();assert.equal(socket.sent[0].execution_policy,'IOC');socket.emit(filled(socket.sent[0]));await result;});

test('position protection exact fields, terminal correlation and original-ID reconnect',async()=>{const f=fixture(),promise=f.client.modifyPosition({account_login:1001,position_ticket:TICKET,sl:'80.000000000000000001',tp:null,trailing_stop:'100',trailing_step:0,client_order_id:ID});await tick();const socket=f.sockets[0];socket.open();const frame=socket.sent[0];assert.equal(frame.sl,'80.000000000000000001');assert.equal(frame.tp,null);assert.equal(frame.trailing_stop,100);assert.equal(frame.trailing_step,0);socket.emit({...frame,type:'position_modify_accepted',status:'accepted'});socket.close();await tick();const next=f.sockets[1];next.open();assert.equal(next.sent.at(-1).action,'get_order_status');assert.equal(next.sent.at(-1).client_order_id,ID);let done=false;promise.then(()=>{done=true;});next.emit({...next.sent.at(-1),type:'position_modified',status:'succeeded',data:{ticket_text:'9007199254740994',status:'modified'}});await tick();assert.equal(done,false);next.emit({...next.sent.at(-1),type:'position_modified',status:'succeeded',data:{ticket_text:TICKET,status:'modified'}});assert.equal((await promise).position_ticket,TICKET);assert.equal(f.sockets.flatMap(s=>s.sent).filter(x=>x.action==='modify_position').length,1);assert.throws(()=>f.client.modifyPosition({account_login:1001,position_ticket:TICKET,trailing_stop:'1.5'}));assert.throws(()=>f.client.modifyPosition({account_login:1001,position_ticket:TICKET,trailing_step:'2147483648'}));assert.throws(()=>f.client.modifyPosition({account_login:1001,position_ticket:TICKET,comment:'unsupported'}));});

test('native cancellation reload peek is read-only and explicit recovery only queries original ID',async()=>{
 const f=fixture({deadlineMs:30});const first=f.client.cancelNativePending({account_login:1001,ticket:TICKET,client_order_id:ID});const rejected=assert.rejects(first,error=>error.statusUnknown);await tick();f.sockets[0].open();await rejected;
 const replacement=createManagerTradeSocket({...f.settings,deadlineMs:500}),before=f.settings.storage.getItem('rtx5.manager-ws-commands.v1');
 assert.deepEqual(replacement.peekPending(1001,TICKET),{client_order_id:ID,action:'cancel_pending_order'});assert.equal(f.settings.storage.getItem('rtx5.manager-ws-commands.v1'),before);assert.equal(f.sockets.length,1);
 assert.throws(()=>replacement.cancelNativePending({account_login:1001,ticket:TICKET}),/original pending/);
 const recovery=replacement.recoverPending(1001,TICKET,ID);await tick();const socket=f.sockets.at(-1);socket.open();assert.equal(socket.sent[0].action,'get_order_status');assert.equal(socket.sent[0].client_order_id,ID);
 socket.emit({...socket.sent[0],type:'pending_order_cancel_rejected',status:'rejected',error:{code:'LP_PENDING_CANCEL_REJECTED',message:'Still working'}});await assert.rejects(recovery,error=>error.commandStatus==='rejected');assert.equal(replacement.peekPending(1001,TICKET),null);
 assert.equal(f.sockets.flatMap(s=>s.sent).filter(x=>x.action==='cancel_pending_order').length,1);
});
test('native recovery discovery is account/ticket/session scoped and cannot mint absent identity',()=>{
 const f=fixture();assert.equal(f.client.peekPending(1001,TICKET),null);assert.throws(()=>f.client.recoverPending(1001,TICKET,ID),/Original pending command/);assert.equal(f.sockets.length,0);
 const payload={account_login:1001,ticket:TICKET},record={id:ID,scope:'manager-a',action:'cancel_pending_order',payload,signature:JSON.stringify({action:'cancel_pending_order',payload}),sent:true};
 f.settings.storage.setItem('rtx5.manager-ws-commands.v1',JSON.stringify({[JSON.stringify(['manager-a','pending-mutation','1001:'+TICKET])]:record}));
 assert.equal(f.client.peekPending(1001,TICKET).client_order_id,ID);assert.equal(f.client.peekPending(1002,TICKET),null);assert.equal(f.client.peekPending(1001,'9007199254740994'),null);f.scope('manager-b');assert.equal(f.client.peekPending(1001,TICKET),null);assert.equal(f.sockets.length,0);
});
test('new native cancellation refuses corrupt or unavailable durable storage before transport',()=>{
 const f=fixture();f.settings.storage.setItem('rtx5.manager-ws-commands.v1','{bad');assert.throws(()=>f.client.peekPending(1001,TICKET));assert.throws(()=>f.client.cancelNativePending({account_login:1001,ticket:TICKET}));assert.equal(f.sockets.length,0);
 const blocked=fixture({storage:{getItem:()=>null,setItem:()=>{throw Error('blocked');}}});assert.throws(()=>blocked.client.cancelNativePending({account_login:1001,ticket:TICKET}),/blocked/);assert.equal(blocked.sockets.length,0);
});
test('status-only recovery retains a write-ahead identity when ticket acquisition fails',async()=>{
 const f=fixture({requestTicket:async()=>{throw Error('temporarily unavailable');}});
 const payload={account_login:1001,ticket:TICKET},record={id:ID,scope:'manager-a',action:'cancel_pending_order',payload,signature:JSON.stringify({action:'cancel_pending_order',payload}),sent:false,durable:true};
 const key=JSON.stringify(['manager-a','pending-mutation','1001:'+TICKET]);
 f.settings.storage.setItem('rtx5.manager-ws-commands.v1',JSON.stringify({[key]:record}));
 const replacement=createManagerTradeSocket(f.settings);
 await assert.rejects(replacement.recoverPending(1001,TICKET,ID),error=>error.statusUnknown&&error.client_order_id===ID);
 assert.deepEqual(replacement.peekPending(1001,TICKET),{client_order_id:ID,action:'cancel_pending_order'});
 assert.equal(f.sockets.length,0);
});

test('durable demo close reload is scoped and rejection permits only explicit new identity',async()=>{
 const f=fixture({deadlineMs:30}),input={account_login:1001,position_ticket:TICKET,volume:0,client_order_id:ID};
 const first=f.client.closeDemo(input),unknown=assert.rejects(first,e=>e.statusUnknown);await tick();f.sockets[0].open();
 assert.equal(f.sockets[0].sent[0].demoClose,undefined);assert.equal(f.sockets[0].sent[0].lp_demo_test,undefined);await unknown;
 const replacement=createManagerTradeSocket({...f.settings,deadlineMs:500}),before=f.settings.storage.getItem('rtx5.manager-ws-commands.v1');
 assert.equal(replacement.listDemoCloses(1001)[0].position_ticket,TICKET);assert.deepEqual(replacement.listDemoCloses(1002),[]);f.scope('other');assert.deepEqual(replacement.listDemoCloses(1001),[]);assert.throws(()=>replacement.recoverDemoClose(1001,ID));f.scope('manager-a');assert.equal(f.settings.storage.getItem('rtx5.manager-ws-commands.v1'),before);
 const recovery=replacement.recoverDemoClose(1001,ID),rejected=assert.rejects(recovery,e=>e.commandStatus==='rejected');await tick();const ws=f.sockets.at(-1);ws.open();assert.equal(ws.sent[0].action,'get_order_status');assert.equal(ws.sent[0].client_order_id,ID);
 ws.emit({...ws.sent[0],type:'position_close_rejected',status:'rejected',error:{code:'REFUSED'}});await rejected;
 assert.deepEqual(replacement.listDemoCloses(1001),[]);assert.equal(f.sockets.flatMap(s=>s.sent).filter(x=>x.action==='close_position').length,1);
 const retry=replacement.closeDemo({account_login:1001,position_ticket:TICKET,volume:0});await tick();const next=f.sockets.at(-1);next.open();assert.notEqual(next.sent.at(-1).client_order_id,ID);next.emit({...next.sent.at(-1),type:'position_closed',status:'filled',data:{position_ticket_text:TICKET}});await retry;assert.deepEqual(replacement.listDemoCloses(1001),[]);
});
test('original demo close expiration is terminal despite retryable hint and never resends itself',async()=>{
 const f=fixture({deadlineMs:30}),input={account_login:1001,position_ticket:TICKET,volume:0,client_order_id:ID};
 const first=f.client.closeDemo(input),unknown=assert.rejects(first,e=>e.statusUnknown&&e.client_order_id===ID);await tick();f.sockets[0].open();await unknown;
 const replacement=createManagerTradeSocket({...f.settings,deadlineMs:500});
 const recovery=replacement.recoverDemoClose(1001,ID),expired=assert.rejects(recovery,e=>e.commandStatus==='expired'&&e.code==='ORDER_EXPIRED'&&e.client_order_id===ID);
 await tick();const socket=f.sockets.at(-1);socket.open();const status=socket.sent[0];assert.equal(status.action,'get_order_status');assert.equal(status.client_order_id,ID);
 socket.emit({...status,type:'order_status_error',error:{code:'TEMPORARY_FAILURE',retryable:true}});
 await tick();assert.equal(replacement.listDemoCloses(1001).length,1);
 socket.emit({...status,type:'position_close_rejected',status:'expired',error:{code:'ORDER_EXPIRED',message:'Expired before execution',retryable:true}});
 await expired;assert.deepEqual(replacement.listDemoCloses(1001),[]);
 assert.equal(f.sockets.flatMap(s=>s.sent).filter(x=>x.action==='close_position').length,1);
 const retry=replacement.closeDemo({account_login:1001,position_ticket:TICKET,volume:0});const denied=assert.rejects(retry,e=>e.commandStatus==='rejected');await tick();const next=f.sockets.at(-1);next.open();assert.notEqual(next.sent.at(-1).client_order_id,ID);
 next.emit({...next.sent.at(-1),type:'position_close_rejected',status:'rejected',error:{code:'REFUSED',retryable:false}});await denied;
 assert.equal(f.sockets.flatMap(s=>s.sent).filter(x=>x.action==='close_position').length,2);
});
test('durable market expiry settles despite retryable hint without another mutation or status poll',async()=>{
 const f=fixture({deadlineMs:300,pollMs:10});
 const order=f.client.place({account_login:1001,symbol:'XAUUSD',side:'buy',volume:'0.01',client_order_id:ID});
 const expired=assert.rejects(order,error=>error.code==='ORDER_EXPIRED'&&error.commandStatus==='expired'&&error.statusUnknown!==true);
 await tick();const socket=f.sockets[0];socket.open();const sent=socket.sent[0];
 assert.equal(sent.action,'place_order');assert.equal(sent.client_order_id,ID);
 socket.emit({...sent,type:'order_accepted',status:'accepted'});
 socket.emit({...sent,type:'order_rejected',status:'expired',error:{code:'ORDER_EXPIRED',retryable:true}});
 await expired;
 await new Promise(resolve=>setTimeout(resolve,30));
 assert.equal(socket.sent.filter(frame=>frame.action==='place_order').length,1);
 assert.equal(socket.sent.filter(frame=>frame.action==='get_order_status').length,0);
});

test('durable retryable market rejection settles without another mutation or status poll',async()=>{
 const f=fixture({deadlineMs:300,pollMs:10});
 const order=f.client.place({account_login:1001,symbol:'XAUUSD',side:'buy',volume:'0.01',client_order_id:ID});
 const denied=assert.rejects(order,error=>error.code==='INTERNAL_ERROR'&&error.commandStatus==='rejected'&&error.statusUnknown!==true);
 await tick();const socket=f.sockets[0];socket.open();const sent=socket.sent[0];
 socket.emit({...sent,type:'order_accepted',status:'accepted'});
 socket.emit({...sent,type:'order_rejected',status:'rejected',error:{code:'INTERNAL_ERROR',retryable:true}});
 await denied;await new Promise(resolve=>setTimeout(resolve,30));
 assert.equal(socket.sent.filter(frame=>frame.action==='place_order').length,1);
 assert.equal(socket.sent.filter(frame=>frame.action==='get_order_status').length,0);
});
test('demo close requires intact storage before transport and keeps ordinary wire unchanged',()=>{
 const input={account_login:1001,position_ticket:TICKET,volume:0};
 for(const storage of [null,{getItem:()=>null,setItem:()=>{throw Error('blocked');}},{getItem:()=>'{bad',setItem:()=>{}}]){
  const f=fixture({storage});
  assert.throws(()=>f.client.closeDemo(input));assert.equal(f.sockets.length,0);
 }
 const f=fixture(),payload={account_login:1001,volume:0,position_ticket:TICKET},signature=JSON.stringify({action:'close_position',payload}),key=JSON.stringify(['manager-a','close_position','1001:'+TICKET]);
 for(const patch of [{demoClose:false},{payload:null},{id:[ID]},{signature:null}]){
  const record={id:ID,scope:'manager-a',action:'close_position',payload,signature,sent:true,durable:true,demoClose:true,...patch};f.settings.storage.setItem('rtx5.manager-ws-commands.v1',JSON.stringify({[key]:record}));assert.throws(()=>f.client.listDemoCloses(1001));assert.throws(()=>f.client.closeDemo(input));assert.equal(f.sockets.length,0);
 }
});
test('durable demo opening missing marker fails closed but ordinary legacy market remains readable',()=>{
 const f=fixture(),payload={account_login:1001,volume:.01,symbol:'EURUSD',side:'buy',type:'market'},signature=JSON.stringify({action:'place_order',payload}),key=JSON.stringify(['manager-a','place_order',signature]);
 const record={id:ID,scope:'manager-a',action:'place_order',payload,signature,sent:true,durable:true};
 for(const body of [payload,null,{...payload,lp_demo_test:null}]){f.settings.storage.setItem('rtx5.manager-ws-commands.v1',JSON.stringify({[key]:{...record,payload:body}}));assert.throws(()=>f.client.listDemos(1001));assert.throws(()=>f.client.place({...payload,lp_demo_test:demoMarker()}));assert.equal(f.sockets.length,0);}
 delete record.durable;f.settings.storage.setItem('rtx5.manager-ws-commands.v1',JSON.stringify({[key]:record}));assert.deepEqual(f.client.listDemos(1001),[]);
});
test('pending Modify requires an exact expected version string, never on cancel or placement',()=>{
 const f=fixture();
 assert.throws(()=>f.client.modifyPending({account_login:1001,ticket:TICKET,price:'1.1'}),error=>error.code==='EXPECTED_VERSION_REQUIRED');
 for(const value of [7,'07','0','-1','1.0','9223372036854775808',null,['7']])assert.throws(()=>f.client.modifyPending({account_login:1001,ticket:TICKET,expected_version:value,price:'1.1'}),/expected pending version/);
 assert.throws(()=>f.client.modifyPending({account_login:1001,ticket:TICKET,expected_version:'7'}),/at least one pending field/);
 assert.throws(()=>f.client.cancelPending({account_login:1001,ticket:TICKET,expected_version:'7'}),/only valid for Modify/);
 assert.throws(()=>f.client.cancelNativePending({account_login:1001,ticket:TICKET,expected_version:'7'}),/only valid for Modify/);
 assert.throws(()=>f.client.placePending({account_login:1001,symbol:'EURUSD',type:'buy_limit',volume:'1',price:'1',expected_version:'7'}),/only valid for Modify/);
 assert.equal(f.sockets.length,0);
});
test('expected version survives the saved record, reconstruction and same-UUID recovery; success awaits readback',async()=>{
 const f=fixture({deadlineMs:30}),version='9223372036854775807';
 const first=f.client.modifyPending({account_login:1001,ticket:TICKET,expected_version:version,price:'65000.5',expiry:null,client_order_id:ID});const lost=assert.rejects(first,error=>error.statusUnknown&&error.client_order_id===ID);await tick();f.sockets[0].open();
 const frame=f.sockets[0].sent[0];assert.equal(frame.action,'modify_pending_order');assert.equal(frame.expected_version,version);assert.equal(frame.price,'65000.5');assert.equal(frame.expiry,null);await lost;
 const saved=Object.values(JSON.parse(f.settings.storage.getItem('rtx5.manager-ws-commands.v1')));assert.equal(saved.length,1);assert.equal(saved[0].payload.expected_version,version);assert.equal(saved[0].id,ID);
 const replacement=createManagerTradeSocket({...f.settings,deadlineMs:500});
 assert.deepEqual(replacement.peekPending(1001,TICKET),{client_order_id:ID,action:'modify_pending_order'});
 assert.throws(()=>replacement.cancelNativePending({account_login:1001,ticket:TICKET}),/original pending/);
 const recovery=replacement.recoverPending(1001,TICKET,ID);await tick();const socket=f.sockets.at(-1);socket.open();assert.equal(socket.sent[0].action,'get_order_status');assert.equal(socket.sent[0].client_order_id,ID);
 socket.emit({...socket.sent[0],type:'pending_order_modified',status:'succeeded',data:{ticket_text:TICKET,status:'modified',account_login:1001,state_version:'8',price_decimal:'65000.5'}});
 const result=await recovery;assert.equal(result.awaiting_readback,true);assert.equal(result.state_version,'8');assert.equal(result.client_order_id,ID);assert.equal(typeof result.checkStatus,'function');
 const again=result.checkStatus();await tick();const status=f.sockets.at(-1);status.open();assert.equal(status.sent.at(-1).action,'get_order_status');assert.equal(status.sent.at(-1).client_order_id,ID);status.emit({...status.sent.at(-1),type:'pending_order_modified',status:'succeeded',data:{ticket_text:TICKET,status:'modified',account_login:1001,state_version:'8'}});await again;
 assert.equal(f.sockets.flatMap(s=>s.sent).filter(x=>x.action==='modify_pending_order').length,1);
});
test('protection success awaits readback and keeps same-UUID status recovery; close does not',async()=>{
 const f=fixture(),promise=f.client.modifyPosition({account_login:1001,position_ticket:TICKET,sl:'80.1',client_order_id:ID});await tick();const socket=f.sockets[0];socket.open();const frame=socket.sent[0];
 socket.emit({...frame,type:'position_modified',status:'succeeded',data:{ticket_text:TICKET,status:'modified',state_version:'4',protection_version:'2'}});const result=await promise;assert.equal(result.awaiting_readback,true);assert.equal(result.protection_version,'2');
 const status=result.checkStatus();await tick();const next=f.sockets.at(-1);next.open();assert.equal(next.sent.at(-1).action,'get_order_status');assert.equal(next.sent.at(-1).client_order_id,ID);next.emit({...next.sent.at(-1),type:'position_modified',status:'succeeded',data:{ticket_text:TICKET,status:'modified'}});await status;
 const close=f.client.close({account_login:1001,position_ticket:TICKET,volume:0});await tick();const c=f.sockets.at(-1);c.open();c.emit(filled(c.sent.at(-1),true));assert.equal((await close).awaiting_readback,undefined);
});
test('legacy pending Modify is a separate entry: no version, legacy terms, settles on the terminal outcome',async()=>{
 const f=fixture();
 assert.throws(()=>f.client.modifyPendingLegacy({account_login:1001,ticket:TICKET,expected_version:'7',price:'1.1'}),error=>error.code==='LEGACY_MODIFY_VERSIONED');
 assert.throws(()=>f.client.modifyPending({account_login:1001,ticket:TICKET,sl:'1.0'}),error=>error.code==='EXPECTED_VERSION_REQUIRED');
 assert.equal(f.sockets.length,0);
 const promise=f.client.modifyPendingLegacy({account_login:1001,ticket:TICKET,sl:'1.05',tp:null,client_order_id:ID});await tick();const socket=f.sockets[0];socket.open();const frame=socket.sent[0];
 assert.equal(frame.action,'modify_pending_order');assert.equal(Object.hasOwn(frame,'expected_version'),false);assert.equal(frame.sl,'1.05');assert.equal(frame.tp,null);
 assert.deepEqual(f.client.peekPending(1001,TICKET),{client_order_id:ID,action:'modify_pending_order'});
 socket.emit({...frame,type:'pending_order_modified',status:'succeeded',data:{ticket_text:TICKET,status:'modified',account_login:1001}});
 const result=await promise;assert.equal(result.awaiting_readback,undefined);assert.equal(result.ok,true);assert.equal(f.client.peekPending(1001,TICKET),null);
});

test('warmup opens one account-bound socket and subsequent commands reuse its ticket and connection',async()=>{
 let tickets=0;const f=fixture({requestTicket:async()=>{tickets++;return {ticket:'synthetic'};}});
 const preflight=f.client.warmup(1001);await tick();assert.equal(f.sockets.length,1);assert.equal(f.sockets[0].sent.length,0);
 f.sockets[0].open();const timing=await preflight;assert.equal(timing.account_login,1001);assert.equal(timing.reused,false);
 assert.equal(tickets,1);assert.ok(timing.total_ms>=timing.ticket_ms);
 const order=f.client.place({account_login:1001,symbol:'EURUSD',side:'buy',volume:.01,client_order_id:ID});await tick();
 assert.equal(tickets,1);assert.equal(f.sockets.length,1);assert.equal(f.sockets[0].sent.length,1);
 f.sockets[0].emit(filled(f.sockets[0].sent[0]));await order;
 const warmAgain=await f.client.warmup(1001);assert.equal(warmAgain.reused,true);assert.equal(tickets,1);
});

test('shared socket correlates concurrent commands and ignores crossed and late frames',async()=>{
 const otherID='11111111-1111-4111-8111-111111111111',f=fixture();
 const first=f.client.place({account_login:1001,symbol:'EURUSD',side:'buy',volume:.01,client_order_id:ID});
 const second=f.client.place({account_login:1001,symbol:'EURUSD',side:'sell',volume:.01,client_order_id:otherID});
 await tick();assert.equal(f.sockets.length,1);const ws=f.sockets[0];ws.open();assert.equal(ws.sent.length,2);
 const a=ws.sent.find(x=>x.client_order_id===ID),b=ws.sent.find(x=>x.client_order_id===otherID);
 assert.equal(ws.sent.filter(x=>x.action==='place_order').length,2);
 ws.emit({...filled(a),request_id:b.request_id});
 let aDone=false,bDone=false;first.then(()=>{aDone=true;});second.then(()=>{bDone=true;});await tick();assert.equal(aDone,false);assert.equal(bDone,false);
 ws.emit(filled(a));await first;ws.emit(filled(a));await tick();assert.equal(bDone,false);
 ws.emit({...filled(b),data:{...filled(b).data,client_order_id:otherID}});await second;
 assert.equal(ws.sent.filter(x=>x.action==='place_order').length,2);
});

test('one shared disconnect recovers each original ID by status only',async()=>{
 const otherID='11111111-1111-4111-8111-111111111111',f=fixture();
 const first=f.client.place({account_login:1001,symbol:'EURUSD',side:'buy',volume:.01,client_order_id:ID});
 const second=f.client.place({account_login:1001,symbol:'EURUSD',side:'sell',volume:.01,client_order_id:otherID});
 await tick();f.sockets[0].open();assert.equal(f.sockets[0].sent.length,2);f.sockets[0].close();await tick();
 assert.equal(f.sockets.length,2);f.sockets[1].open();const recovery=f.sockets[1].sent;
 assert.equal(recovery.length,2);assert.ok(recovery.every(x=>x.action==='get_order_status'));
 assert.deepEqual(new Set(recovery.map(x=>x.client_order_id)),new Set([ID,otherID]));
 for(const frame of recovery)f.sockets[1].emit({...filled(frame),data:{...filled(frame).data,client_order_id:frame.client_order_id}});
 await Promise.all([first,second]);assert.equal(f.sockets.flatMap(s=>s.sent).filter(x=>x.action==='place_order').length,2);
});

test('pooled sockets stay isolated by account and retire when the auth scope changes',async()=>{
 let tickets=0;const f=fixture({requestTicket:async()=>{tickets++;return {ticket:'synthetic'};}});
 const a=f.client.warmup(1001);await tick();f.sockets[0].open();await a;
 const b=f.client.warmup(1002);await tick();assert.equal(f.sockets.length,2);f.sockets[1].open();await b;
 assert.equal(tickets,2);assert.equal(f.sockets[0].readyState,1);assert.equal(f.sockets[1].readyState,1);
 f.scope('manager-b');const next=f.client.warmup(1001);await tick();assert.equal(f.sockets[0].readyState,3);assert.equal(f.sockets[1].readyState,3);
 assert.equal(f.sockets.length,3);f.sockets[2].open();await next;assert.equal(tickets,3);
});

test('a broker transport target change retires the old pooled socket before another command',async()=>{
 let target='gateway-one';const f=fixture({getTransportScope:()=>target});
 const first=f.client.warmup(1001);await tick();f.sockets[0].open();await first;
 target='gateway-two';const second=f.client.warmup(1001);await tick();assert.equal(f.sockets[0].readyState,3);
 assert.equal(f.sockets.length,2);f.sockets[1].open();await second;
 const order=f.client.place({account_login:1001,symbol:'EURUSD',side:'buy',volume:.01,client_order_id:ID});await tick();
 assert.equal(f.sockets[0].sent.length,0);assert.equal(f.sockets[1].sent.length,1);
 f.sockets[1].emit(filled(f.sockets[1].sent[0]));await order;
});

test('warmup deadline includes a hung ticket request and sends no frames',async()=>{
 let tickets=0;const f=fixture({deadlineMs:30,requestTicket:async()=>{tickets++;if(tickets===1)return new Promise(()=>{});return {ticket:'synthetic'};}});
 const started=performance.now();await assert.rejects(f.client.warmup(1001),/warmup timed out/);
 assert.ok(performance.now()-started<1000);assert.equal(f.sockets.length,0);
 const retry=f.client.warmup(1001);await tick();assert.equal(tickets,2);assert.equal(f.sockets.length,1);
 f.sockets[0].open();await retry;assert.equal(f.sockets[0].sent.length,0);
});

test('a hung ticket still obeys the original trade deadline without a mutation frame',async()=>{
 const f=fixture({deadlineMs:30,requestTicket:async()=>new Promise(()=>{})});
 const started=performance.now();await assert.rejects(f.client.placePending({account_login:1001,symbol:'EURUSD',type:'buy_limit',volume:'0.01',price:'1.0',client_order_id:ID}),error=>error.statusUnknown===true&&error.orderWasSent===false);
 assert.ok(performance.now()-started<1000);assert.equal(f.sockets.length,0);
});

const openBetweenAcquireAndHandler=()=>{
 let sockets,queued=false;
 const f=fixture({deadlineMs:100,getScope:()=>{
  if(sockets?.length===1&&sockets[0].readyState===0&&!queued){queued=true;queueMicrotask(()=>sockets[0].open());}
  return 'manager-a';
 }});
 sockets=f.sockets;return {f,wasQueued:()=>queued};
};

test('trade catches an open event between acquire and handler attachment exactly once',async()=>{
 const {f,wasQueued}=openBetweenAcquireAndHandler();
 const order=f.client.place({account_login:1001,symbol:'EURUSD',side:'buy',volume:.01,client_order_id:ID});
 await tick();assert.equal(wasQueued(),true);assert.equal(f.sockets.length,1);
 const ws=f.sockets[0];assert.equal(ws.sent.length,1);assert.equal(ws.sent[0].action,'place_order');assert.equal(ws.sent[0].client_order_id,ID);
 ws.emit(filled(ws.sent[0]));await order;assert.equal(ws.sent.filter(x=>x.action==='place_order').length,1);
});

test('warmup catches an open event between acquire and handler attachment without frames',async()=>{
 const {f,wasQueued}=openBetweenAcquireAndHandler();const preflight=f.client.warmup(1001);
 const result=await preflight;assert.equal(wasQueued(),true);assert.equal(result.account_login,1001);
 assert.equal(f.sockets.length,1);assert.equal(f.sockets[0].sent.length,0);
});

test('queued physical open after current-state handling cannot duplicate a mutation',async()=>{
 let sockets,queued=false;
 const f=fixture({deadlineMs:100,getScope:()=>{
  if(sockets?.length===1&&sockets[0].readyState===0&&!queued){queued=true;sockets[0].readyState=1;setTimeout(()=>sockets[0].onopen?.(),0);}
  return 'manager-a';
 }});sockets=f.sockets;
 const order=f.client.place({account_login:1001,symbol:'EURUSD',side:'buy',volume:.01,client_order_id:ID});
 await tick();await tick();assert.equal(queued,true);const ws=f.sockets[0];
 assert.equal(ws.sent.length,1);assert.equal(ws.sent[0].client_order_id,ID);
 ws.emit(filled(ws.sent[0]));await order;assert.equal(ws.sent.filter(x=>x.action==='place_order').length,1);
});

test('timed-out trade retires a hung ticket so original-ID status recovery gets a fresh connection',async()=>{
 let tickets=0,releaseFirst;const f=fixture({deadlineMs:30,requestTicket:async()=>{tickets++;if(tickets===1)return new Promise(resolve=>{releaseFirst=resolve;});return {ticket:'synthetic'};}});
 const first=f.client.place({account_login:1001,symbol:'EURUSD',side:'buy',volume:.01,client_order_id:ID});
 let failure;await assert.rejects(first,error=>{failure=error;return error.statusUnknown===true&&error.orderWasSent===false;});
 assert.equal(f.sockets.length,0);releaseFirst({ticket:'late-stale'});await tick();assert.equal(f.sockets.length,0);
 const recovery=failure.checkStatus();await tick();
 assert.equal(tickets,2);assert.equal(f.sockets.length,1);f.sockets[0].open();
 const status=f.sockets[0].sent[0];assert.equal(status.action,'get_order_status');assert.equal(status.client_order_id,ID);
 f.sockets[0].emit(filled(status));await recovery;
 assert.equal(f.sockets[0].sent.filter(x=>x.action==='place_order').length,0);
});

test('one timed-out waiter does not abort a concurrent account ticket acquisition',async()=>{
 let resolveTicket,tickets=0;const f=fixture({deadlineMs:250,requestTicket:()=>{tickets++;return new Promise(resolve=>{resolveTicket=resolve;});}});
 const first=f.client.warmup(1001);await tick();
 await new Promise(resolve=>setTimeout(resolve,120));const second=f.client.warmup(1001);
 await assert.rejects(first,/warmup timed out/);assert.equal(tickets,1);
 resolveTicket({ticket:'synthetic'});await tick();assert.equal(f.sockets.length,1);f.sockets[0].open();
 const result=await second;assert.equal(result.account_login,1001);assert.equal(f.sockets[0].sent.length,0);
});
