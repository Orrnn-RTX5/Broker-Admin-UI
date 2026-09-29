import {copyLPDemoMarker} from './lpDemoMarker.js';
// Small account-bound client for the canonical Gateway command vocabulary.
// Durable acceptance is not a fill; uncertainty can only query the original ID.
export const tradeUUID=()=>{if(!globalThis.crypto?.randomUUID)throw new Error('Secure command identity unavailable.');return crypto.randomUUID();};
export const exactTradeTicket=value=>{const text=String(value??'');if((typeof value==='number'&&!Number.isSafeInteger(value))||!/^[1-9][0-9]*$/.test(text)||BigInt(text)>9223372036854775807n)throw new Error('An exact signed int64 position ticket is required.');return text;};
const uuid=value=>/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const pendingActions=['place_pending_order','cancel_pending_order','modify_pending_order'];
const vocabulary={modify_position:['position_modify_accepted','position_modified','position_modify_rejected'],place_order:['order_accepted','order_filled','order_rejected'],close_position:['position_close_accepted','position_closed','position_close_rejected'],place_pending_order:['pending_order_accepted','pending_order_placed','pending_order_rejected'],cancel_pending_order:['pending_order_cancel_accepted','pending_order_cancelled','pending_order_cancel_rejected'],modify_pending_order:['pending_order_modify_accepted','pending_order_modified','pending_order_modify_rejected']};
const pendingVersion=value=>{if(typeof value!=='string'||!/^[1-9][0-9]*$/.test(value)||BigInt(value)>9223372036854775807n)throw new Error('The expected pending version must be an exact int64 string.');return value;};
const decimal=(value,positive=false)=>{const text=String(value??'');if(!/^(0|[1-9][0-9]*)(\.[0-9]{1,18})?$/.test(text)||text.length>58||(positive&&!/[1-9]/.test(text)))throw new Error('Enter an exact decimal with up to 18 places.');return text;};
export function createManagerTradeSocket({requestTicket,buildUrl,getScope,storage=globalThis.sessionStorage,createSocket=url=>new WebSocket(url),deadlineMs=20000,pollMs=1000}){
 const memory=new Map(),active=new Map(),storageKey='rtx5.manager-ws-commands.v1';
 const load=()=>{try{for(const [key,value]of Object.entries(JSON.parse(storage?.getItem(storageKey)||'{}')))memory.set(key,value);}catch{/* unreadable recovery storage starts empty */}};
 const persist=(required=false)=>{try{if(required&&!storage)throw new Error('Command recovery storage is unavailable.');storage?.setItem(storageKey,JSON.stringify(Object.fromEntries(memory)));}catch(error){if(required)throw error;}};
 load();
 const placementChanged=()=>{if(typeof window!=='undefined')window.dispatchEvent(new Event('rtx:pending-placement-changed'));};
 const normalize=(action,input)=>{
  const login=Number(input.account_login??input.login),volume=Number(input.volume??input.lots??0);
  if(!Number.isSafeInteger(login)||login<=0)throw new Error('A valid account login is required.');
  if(input.lp_demo_test!==undefined&&action!=='place_order')throw new Error('Demo preview is only valid for market placement.');
  if(action==='modify_position'){
   const payload={account_login:login,position_ticket:exactTradeTicket(input.position_ticket??input.ticket)};
   if(['comment','price','volume','lots','symbol','type'].some(key=>Object.hasOwn(input,key)))throw new Error('Position protection cannot change comment, price, volume, symbol or type.');
   for(const [key,alias]of [['sl','stoploss'],['tp','takeprofit'],['trailing_stop','trailing_stop'],['trailing_step','trailing_step']]){const value=Object.hasOwn(input,key)?input[key]:input[alias];if(value===undefined)continue;if(value===null){payload[key]=null;continue;}if(key.startsWith('trailing_')){const text=String(value);if(!/^(0|[1-9][0-9]*)$/.test(text)||BigInt(text)>2147483647n)throw new Error('Trailing protection must use integer points from 0 to 2147483647.');payload[key]=Number(text);}else payload[key]=decimal(value);}
   if(Object.keys(payload).length===2)throw new Error('Choose at least one protection field.');return payload;
  }
  if(pendingActions.includes(action)){
   const payload={account_login:login},modify=action==='modify_pending_order',place=action==='place_pending_order';
   if(input.require_native!==undefined){if(!place||typeof input.require_native!=='boolean')throw new Error('Invalid native placement requirement.');payload.require_native=input.require_native;}
   if(['trailing','trailing_stop','magic'].some(key=>Object.hasOwn(input,key)))throw new Error('Trailing and magic fields are unavailable on this pending command.');
   if(place){payload.symbol=String(input.symbol||'').trim().toUpperCase();payload.type=String(input.type||'').toLowerCase();if(!payload.symbol||!['buy_limit','sell_limit','buy_stop','sell_stop'].includes(payload.type))throw new Error('Select a limit or stop order. Stop-limit trigger capture is unavailable.');payload.volume=decimal(input.volume??input.lots,true);payload.price=decimal(input.price,true);if(input.comment)payload.comment=String(input.comment);}
   else{payload.ticket=exactTradeTicket(input.ticket);if(['volume','lots','type','symbol','comment'].some(key=>Object.hasOwn(input,key)))throw new Error('Pending modification cannot change volume, type, symbol or comment.');}
   // The version comes from a fresh pending read; the Gateway refuses a changed row.
   if(Object.hasOwn(input,'expected_version')){if(!modify)throw new Error('An expected pending version is only valid for Modify.');payload.expected_version=pendingVersion(input.expected_version);}
   if(place||modify){for(const [name,alias]of [['price','price'],['price_limit','price_limit'],['sl','stoploss'],['tp','takeprofit']]){const value=Object.hasOwn(input,name)?input[name]:input[alias];if(value!==undefined)payload[name]=value===null&&name!=='price'?null:decimal(value,name==='price');}
    if(Object.hasOwn(input,'expiry')){const expiry=input.expiry;if(expiry!==null&&(!Number.isSafeInteger(expiry)||expiry<=0))throw new Error('Expiry must be UTC Unix seconds or null for GTC.');payload.expiry=expiry;}
    if(modify&&Object.keys(payload).filter(key=>key!=='expected_version').length===2)throw new Error('Choose at least one pending field to modify.');
   }else if(['price','price_limit','sl','tp','stoploss','takeprofit','expiry'].some(key=>Object.hasOwn(input,key)))throw new Error('Cancellation cannot modify pending terms.');
   return payload;
  }
  if(!Number.isFinite(volume)||volume<0||(action==='place_order'&&volume===0))throw new Error('Enter a valid lot volume.');
  const payload={account_login:login,volume};
  if(input.lp_demo_test!==undefined){if(action!=='place_order')throw new Error('Demo preview is only valid for market placement.');payload.lp_demo_test=copyLPDemoMarker(input.lp_demo_test);}
  if(action==='close_position')payload.position_ticket=exactTradeTicket(input.position_ticket??input.ticket);
  else{if(input.execution_policy!==undefined){if(!['FOK','IOC'].includes(input.execution_policy))throw new Error('Choose FOK or IOC.');payload.execution_policy=input.execution_policy;}payload.symbol=String(input.symbol||'').trim().toUpperCase();payload.side=String(input.side??input.operation??'').toLowerCase();payload.type='market';if(!payload.symbol||!['buy','sell'].includes(payload.side))throw new Error('Select a market symbol and buy or sell.');
   for(const [name,old]of [['sl','stoploss'],['tp','takeprofit']]){const value=Number(input[name]??input[old]??0);if(!Number.isFinite(value)||value<0)throw new Error('Protection prices must be nonnegative.');if(value>0)payload[name]=value;}
   if(input.comment)payload.comment=String(input.comment);
  }return payload;
 };
 const run=(record,key,statusOnly=false)=>{
  if(active.has(key))return active.get(key);
  const scope=getScope();if(!scope||scope!==record.scope)return Promise.reject(new Error('The authenticated session changed.'));
  const promise=new Promise((resolve,reject)=>{
   let socket,timer,poll,done=false,attempt=0,requestID='',generation=0;
   const finish=(error,value,terminal=false)=>{if(done)return;done=true;generation++;clearTimeout(timer);clearTimeout(poll);if(socket)socket.close();if(terminal){memory.delete(key);persist();if(record.action==='place_pending_order')placementChanged();}error?reject(error):resolve(value);};
   const unknown=cause=>Object.assign(new Error('Execution status is unresolved. Keep command '+record.id+' for account '+record.payload.account_login+' and check its status before another trade.'),{code:'ORDER_STATUS_UNKNOWN',statusUnknown:true,orderWasSent:record.sent,client_order_id:record.id,clientOrderId:record.id,account_login:record.payload.account_login,cause,checkStatus:()=>run(record,key,true)});
   const query=()=>{if(done||!socket||socket.readyState!==1)return;requestID=tradeUUID();socket.send(JSON.stringify({action:'get_order_status',request_id:requestID,client_order_id:record.id,account_login:record.payload.account_login}));};
   const schedule=()=>{clearTimeout(poll);poll=setTimeout(()=>{try{query();}catch(e){finish(unknown(e));}},pollMs);};
   const connect=async()=>{
    const current=++generation;attempt++;
    try{
     if(getScope()!==scope)throw new Error('Authenticated session changed.');
     const ticket=await requestTicket(record.payload.account_login);if(done||generation!==current)return;
     if(getScope()!==scope)throw new Error('Authenticated session changed.');
     socket=createSocket(buildUrl(ticket));const ws=socket;
     ws.onopen=()=>{if(done||generation!==current)return;if(getScope()!==scope){finish(unknown());return;}try{
      requestID=tradeUUID();const recover=statusOnly||record.sent;
      if(!recover){record.sent=true;memory.set(key,record);persist(record.durable===true);}
      ws.send(JSON.stringify(recover?{action:'get_order_status',request_id:requestID,client_order_id:record.id,account_login:record.payload.account_login}:{action:record.action,request_id:requestID,client_order_id:record.id,...record.payload}));
     }catch(e){finish(unknown(e));}};
     ws.onmessage=event=>{
      if(done||generation!==current||getScope()!==scope){if(!done)finish(unknown());return;}
      let message;try{message=JSON.parse(event.data);}catch{return;}
      if(message.request_id!==requestID||message.client_order_id!==record.id)return;
      if([message.account_login,message.data?.account_login].some(value=>value!==undefined&&String(value)!==String(record.payload.account_login)))return;
      const protection=record.action==='modify_position',close=record.action==='close_position',pending=pendingActions.includes(record.action),type=message.type,[accepted,completed,rejected]=vocabulary[record.action];
      if(type===accepted){schedule();return;}
      if(type===completed&&((pending||protection)?message.status==='succeeded':['filled','succeeded'].includes(message.status))){
       const data=message.data;if(!data||typeof data!=='object')return;
       if(pending){let ticket;try{ticket=exactTradeTicket(data.ticket_text??data.ticket);}catch{return;}if(record.payload.ticket&&ticket!==record.payload.ticket)return;const expected=record.action==='place_pending_order'?'pending':record.action==='cancel_pending_order'?'cancelled':'modified';if(data.status!==expected)return;data.ticket=ticket;}
       else if(protection){let ticket;try{ticket=exactTradeTicket(data.position_ticket_text??data.ticket_text??data.position_ticket??data.ticket);}catch{return;}if(ticket!==record.payload.position_ticket||data.status!=='modified')return;data.position_ticket=ticket;}
       else if(close){let ticket;try{ticket=exactTradeTicket(data.position_ticket_text??data.ticket_text??data.position_ticket??data.ticket);}catch{return;}if(ticket!==record.payload.position_ticket)return;}
       else{for(const name of ['position_ticket','order_ticket']){const value=data[name+'_text']??data[name];if(value!==undefined){try{data[name]=exactTradeTicket(value);}catch{return;}}}}
       if(data.client_order_id!==undefined&&data.client_order_id!==record.id)return;
       // A positive Modify/protection outcome is shown as settled only after the caller's matching read.
       // A legacy pending Modify (no expected_version) settles on its terminal outcome as before.
       const readback=protection||(record.action==='modify_pending_order'&&record.payload.expected_version)?{awaiting_readback:true,checkStatus:()=>run(record,key,true)}:{};
       finish(null,{...data,success:true,ok:true,status:message.status,client_order_id:record.id,account_login:record.payload.account_login,...readback},true);return;
      }
      const terminalExpiredClose=close&&type==='position_close_rejected'&&message.status==='expired'&&message.error?.code==='ORDER_EXPIRED';
      if(type===rejected&&['rejected','expired'].includes(message.status)&&(message.error?.retryable!==true||terminalExpiredClose)){
       finish(Object.assign(new Error(message.error?.message||'Trade command rejected.'),{code:message.error?.code,client_order_id:record.id,account_login:record.payload.account_login,commandStatus:message.status}),null,true);return;
      }
      if(['order_error','order_status_error','error'].includes(type)||message.status==='accepted'||message.status==='processing')schedule();
     };
     ws.onerror=()=>ws.close();
     ws.onclose=()=>{if(done||generation!==current)return;clearTimeout(poll);if(attempt<3)connect();else finish(unknown());};
    }catch(e){if(done||generation!==current)return;finish(statusOnly||record.sent?unknown(e):Object.assign(e,{client_order_id:record.id,orderWasSent:false}),null,!(statusOnly||record.sent));}
   };
   timer=setTimeout(()=>finish(unknown()),deadlineMs);connect();
  }).finally(()=>active.delete(key));active.set(key,promise);return promise;
 };
 const savedPlacements=account=>{
  const login=Number(account),scope=getScope();
  if(!scope||!Number.isSafeInteger(login)||login<=0)throw new Error('Authenticated account scope is required.');
  if(!storage)throw new Error('Command recovery storage is unavailable.');
  const records=JSON.parse(storage.getItem(storageKey)||'{}');
  if(!records||typeof records!=='object'||Array.isArray(records))throw new Error('Command recovery storage is invalid.');
  const found=[],ids=new Set();
  for(const [key,record]of Object.entries(records)){
   if(!record||typeof record!=='object'||typeof record.action!=='string')throw new Error('Command recovery storage is invalid.');
   if(record.action!=='place_pending_order')continue;
   if(typeof record.id!=='string'||!uuid(record.id)||typeof record.scope!=='string'
    ||!record.payload||typeof record.payload!=='object'||Array.isArray(record.payload)
    ||typeof record.signature!=='string'||typeof record.sent!=='boolean')throw new Error('Original placement identity is invalid.');
   const normalized=normalize(record.action,record.payload);
   if(Object.keys(record.payload).length!==Object.keys(normalized).length
    ||Object.entries(record.payload).some(([name,value])=>!Object.hasOwn(normalized,name)||value!==normalized[name])
    ||record.signature!==JSON.stringify({action:record.action,payload:normalized})
    ||key!==JSON.stringify([record.scope,record.action,record.signature]))throw new Error('Original placement identity is invalid.');
   if(record.scope!==scope||record.payload.account_login!==login)continue;
   if(ids.has(record.id))throw new Error('Original placement identity is ambiguous.');
   ids.add(record.id);found.push({record,key});
  }
  return found;
 };
 const savedDemos=account=>{
  const login=Number(account),scope=getScope();
  if(!scope||!Number.isSafeInteger(login)||login<=0)throw new Error('Authenticated account scope is required.');
  if(!storage)throw new Error('Command recovery storage is unavailable.');
  const records=JSON.parse(storage.getItem(storageKey)||'{}');
  if(!records||typeof records!=='object'||Array.isArray(records))throw new Error('Command recovery storage is invalid.');
  const found=[],ids=new Set();
  for(const [key,record]of Object.entries(records)){
   if(!record||typeof record!=='object'||Array.isArray(record)||typeof record.action!=='string')throw new Error('Command recovery storage is invalid.');
   if(record.action!=='place_order')continue;
   if(!record.payload?.lp_demo_test){if(record.durable===true)throw new Error('Original demo identity is invalid.');continue;}
   if(typeof record.id!=='string'||!uuid(record.id)||typeof record.scope!=='string'||typeof record.sent!=='boolean'||record.durable!==true)throw new Error('Original demo identity is invalid.');
   const normalized=normalize(record.action,record.payload),signature=JSON.stringify({action:record.action,payload:normalized});
   if(record.signature!==signature||JSON.stringify(record.payload)!==JSON.stringify(normalized)||key!==JSON.stringify([record.scope,record.action,signature]))throw new Error('Original demo identity is invalid.');
   if(record.scope!==scope||record.payload.account_login!==login)continue;
   if(ids.has(record.id))throw new Error('Original demo identity is ambiguous.');
   ids.add(record.id);found.push({record,key});
  }
  return found;
 };
 const savedDemoCloses=account=>{
  const login=Number(account),scope=getScope();
  if(!scope||!Number.isSafeInteger(login)||login<=0||!storage)throw new Error('Authenticated account recovery storage is required.');
  const records=JSON.parse(storage.getItem(storageKey)||'{}');
  if(!records||typeof records!=='object'||Array.isArray(records))throw new Error('Command recovery storage is invalid.');
  const found=[],ids=new Set();
  for(const [key,record]of Object.entries(records)){
   if(!record||typeof record!=='object'||Array.isArray(record)||typeof record.action!=='string')throw new Error('Command recovery storage is invalid.');
   if(record.action!=='close_position'||(record.demoClose!==true&&record.durable!==true))continue;
   if(record.demoClose!==true||record.durable!==true||typeof record.id!=='string'||!uuid(record.id)||typeof record.scope!=='string'||typeof record.sent!=='boolean'||!record.payload||typeof record.payload!=='object'||Array.isArray(record.payload))throw new Error('Original demo close identity is invalid.');
   const normalized=normalize(record.action,record.payload),signature=JSON.stringify({action:record.action,payload:normalized});
   if(record.signature!==signature||JSON.stringify(record.payload)!==JSON.stringify(normalized)||key!==JSON.stringify([record.scope,record.action,normalized.account_login+':'+normalized.position_ticket]))throw new Error('Original demo close identity is invalid.');
   if(record.scope!==scope||record.payload.account_login!==login)continue;
   if(ids.has(record.id))throw new Error('Original demo close identity is ambiguous.');ids.add(record.id);found.push({record,key});
  }
  return found;
 };
 const submit=(action,input,durable=false,demoClose=false,legacy=false)=>{
  const payload=normalize(action,input),scope=getScope();if(!scope)throw new Error('Authenticated Manager session required.');
  // Exact Modify carries the read version. The legacy entry is only for rows a
  // fresh server read marked legacy_modify_available; it never carries one.
  if(action==='modify_pending_order'&&legacy&&payload.expected_version)throw Object.assign(new Error('A legacy pending Modify does not carry an exact version.'),{code:'LEGACY_MODIFY_VERSIONED'});
  if(action==='modify_pending_order'&&!legacy&&!payload.expected_version)throw Object.assign(new Error('Read the current pending order first; Modify requires its exact version.'),{code:'EXPECTED_VERSION_REQUIRED'});
  if(action==='place_pending_order'){
   const saved=savedPlacements(payload.account_login);
   for(const [key,record]of memory)if(record.action===action&&record.scope===scope&&record.payload.account_login===payload.account_login&&!active.has(key))memory.delete(key);
   for(const {record,key}of saved)if(!active.has(key))memory.set(key,record);
  }
  const signature=JSON.stringify({action,payload}),target=payload.position_ticket??payload.ticket,key=JSON.stringify([scope,payload.ticket?'pending-mutation':action,target?payload.account_login+':'+target:signature]);
  if(payload.lp_demo_test){
   durable=true;
   for(const saved of savedDemos(payload.account_login)){
    if(saved.record.signature!==signature)throw Object.assign(new Error('Check the original demo command before another test order.'),{code:'COMMAND_PENDING',client_order_id:saved.record.id});
    if(!active.has(saved.key))memory.set(saved.key,saved.record);
   }
  }
  let record=memory.get(key);
  if(record&&record.signature!==signature)throw Object.assign(new Error('An earlier close still requires confirmation. Check its original command before changing volume.'),{code:'COMMAND_PENDING',client_order_id:record.id});
  if(input.client_order_id&&!uuid(input.client_order_id))throw new Error('client_order_id must be a UUID v4.');
  if(record&&input.client_order_id&&record.id!==input.client_order_id)throw new Error('Recover the original command ID before submitting another.');
  const id=record?.id||input.client_order_id||tradeUUID();
  for(const old of memory.values())if(old.id===id&&(old.scope!==scope||old.signature!==signature))throw new Error('Command identity already belongs to another request.');
  const existing=Boolean(record);
  record??={id,scope,signature,action,payload,sent:false};if(durable)record.durable=true;if(demoClose)record.demoClose=true;memory.set(key,record);
  try{persist(durable);}catch(error){if(!existing)memory.delete(key);throw error;}
  if(action==='place_pending_order')placementChanged();
  return run(record,key,(action==='place_pending_order'||Boolean(payload.lp_demo_test)||demoClose)&&existing);
 };
 const existingPending=(account,ticket)=>{
  const payload=normalize('cancel_pending_order',{account_login:account,ticket}),scope=getScope();
  if(!scope)throw new Error('Authenticated Manager session required.');
  if(!storage)throw new Error('Command recovery storage is unavailable.');
  const records=JSON.parse(storage.getItem(storageKey)||'{}');
  if(!records||typeof records!=='object'||Array.isArray(records))throw new Error('Command recovery storage is invalid.');
  const key=JSON.stringify([scope,'pending-mutation',payload.account_login+':'+payload.ticket]),record=records[key];
  if(!record)return null;
  if(!uuid(record.id)||record.scope!==scope||!['cancel_pending_order','modify_pending_order'].includes(record.action)||!record.payload
   ||record.payload.account_login!==payload.account_login||record.payload.ticket!==payload.ticket
   ||record.signature!==JSON.stringify({action:record.action,payload:normalize(record.action,record.payload)}))throw new Error('Original pending command identity is invalid.');
  return {record,key};
 };
 return {listDemoCloses:account=>savedDemoCloses(account).map(({record})=>({...record.payload,client_order_id:record.id})),
 closeDemo:input=>{for(const saved of savedDemoCloses(input.account_login))if(!active.has(saved.key))memory.set(saved.key,saved.record);return submit('close_position',input,true,true);},
 recoverDemoClose:(account,id)=>{const saved=savedDemoCloses(account).find(({record})=>record.id===id);if(!saved)throw new Error('Original demo close identity is required for recovery.');memory.set(saved.key,saved.record);return run(saved.record,saved.key,true);},
 listDemos:account=>savedDemos(account).map(({record})=>({...record.payload,lp_demo_test:copyLPDemoMarker(record.payload.lp_demo_test),client_order_id:record.id})),
 recoverDemo:(account,id)=>{const saved=savedDemos(account).find(({record})=>record.id===id);if(!saved)throw new Error('Original demo identity is required for recovery.');memory.set(saved.key,saved.record);return run(saved.record,saved.key,true);},
 peekPending:(account,ticket)=>{const saved=existingPending(account,ticket);return saved?{client_order_id:saved.record.id,action:saved.record.action}:null;},
 recoverPending:(account,ticket,id)=>{const saved=existingPending(account,ticket);if(!saved||(id&&saved.record.id!==id))throw new Error('Original pending command identity is required for recovery.');return run(saved.record,saved.key,true);},
 cancelNativePending:input=>{const saved=existingPending(input.account_login,input.ticket);if(saved)throw Object.assign(new Error('Check the original pending command before another cancellation.'),{code:'COMMAND_PENDING',client_order_id:saved.record.id});return submit('cancel_pending_order',input,true);},
 listPlacements:account=>savedPlacements(account).map(({record})=>({...record.payload,client_order_id:record.id})),
 recoverPlacement:(account,id)=>{const saved=savedPlacements(account).find(({record})=>record.id===id);if(!saved)throw new Error('Original placement identity is required for recovery.');memory.set(saved.key,saved.record);return run(saved.record,saved.key,true);},
 modifyPosition:input=>submit('modify_position',input),place:input=>submit('place_order',input),close:input=>submit('close_position',input),placePending:input=>submit('place_pending_order',input,true),cancelPending:input=>submit('cancel_pending_order',input),modifyPending:input=>submit('modify_pending_order',input),modifyPendingLegacy:input=>submit('modify_pending_order',input,false,false,true),status:(account,id)=>{
  for(const [key,record]of memory)if(record.scope===getScope()&&record.id===id&&String(record.payload.account_login)===String(account))return run(record,key,true);
  throw new Error('Original command identity and payload are required for recovery.');
 }};
}
