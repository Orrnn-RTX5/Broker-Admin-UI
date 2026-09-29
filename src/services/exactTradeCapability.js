// Server capability gates for Modify and SL/TP from account-trade dialogs.
// The server flag plus the account-trade permission is the only authority:
// a missing, failed or malformed fresh read keeps the control hidden. The one
// exception is a Manager binary without the row-read routes (see below).
const MAX_INT64=9223372036854775807n;
const PENDING_TYPES=['buy_limit','sell_limit','buy_stop','sell_stop'];

export const canonicalInt64Text=value=>typeof value==='string'&&/^[1-9][0-9]*$/.test(value)&&BigInt(value)<=MAX_INT64;
export const exactDecimalText=value=>typeof value==='string'&&value.length<=58&&/^(0|[1-9][0-9]*)(\.[0-9]{1,18})?$/.test(value);

export function canonicalDecimal(value){
 if(!exactDecimalText(value))return null;
 const [whole,fraction='']=value.split('.'),trimmed=fraction.replace(/0+$/,'');
 return trimmed?whole+'.'+trimmed:whole;
}
export const decimalEqual=(left,right)=>{const a=canonicalDecimal(left);return a!==null&&a===canonicalDecimal(right);};
const scaled=value=>{const [whole,fraction='']=value.split('.');return BigInt(whole+fraction.padEnd(18,'0'));};
const unavailable=(message,cause)=>Object.assign(new Error(message),{code:'EXACT_READ_UNAVAILABLE',cause});

export const pendingModifyAllowed=(row,permitted)=>permitted===true&&row?.exact_modify_available===true;
export const protectionAllowed=(position,permitted)=>permitted===true&&position?.exact_protection_available===true;
// Legacy (non-exact) rows keep the existing command path: no expected_version,
// and the server says so explicitly. The two server flags are never both true.
export const legacyPendingModifyAllowed=(row,permitted)=>permitted===true&&row?.legacy_modify_available===true&&row?.exact_modify_available!==true;
export const legacyProtectionAllowed=(position,permitted)=>permitted===true&&position?.legacy_protection_available===true&&position?.exact_protection_available!==true;
export const pendingModifyPath=(row,permitted)=>pendingModifyAllowed(row,permitted)?'exact':legacyPendingModifyAllowed(row,permitted)?'legacy':null;
export const protectionPath=(position,permitted)=>protectionAllowed(position,permitted)?'exact':legacyProtectionAllowed(position,permitted)?'legacy':null;

const identity=(login,ticket)=>{
 const account=String(login??''),text=typeof ticket==='number'&&Number.isSafeInteger(ticket)?String(ticket):ticket;
 if(!canonicalInt64Text(account)||!canonicalInt64Text(text))throw unavailable('An exact account and ticket are required.');
 return {account,ticket:text};
};
const sameAccount=(value,account)=>value!==undefined&&value!==null&&String(value)===account;
const optionalExpiry=value=>value===null||value===undefined?null:Number.isSafeInteger(value)&&value>0?value:undefined;
const canonicalVersionText=value=>value==='0'||canonicalInt64Text(value);
// A legacy flag is optional on the wire (absent means false) but never ambiguous.
const legacyFlag=(row,key,exact)=>{const value=Object.hasOwn(row,key)?row[key]:false;return typeof value!=='boolean'||(value&&exact)?undefined:value;};
const optionalLevel=value=>value===undefined||value===null?null:exactDecimalText(value)?(canonicalDecimal(value)==='0'?null:value):undefined;

export function validateExactPendingRow(value,{login,ticket}){
 const want=identity(login,ticket),row=value&&typeof value==='object'&&!Array.isArray(value)&&value.order&&typeof value.order==='object'?value.order:value;
 if(!row||typeof row!=='object'||Array.isArray(row))throw unavailable('Invalid pending read.');
 const expiry=optionalExpiry(Object.hasOwn(row,'expiry')?row.expiry:row.time_expiry);
 const legacy=typeof row.exact_modify_available==='boolean'?legacyFlag(row,'legacy_modify_available',row.exact_modify_available):undefined;
 const sl=optionalLevel(row.sl_decimal),tp=optionalLevel(row.tp_decimal);
 if(row.ticket_text!==want.ticket||!sameAccount(row.account_login,want.account)||!canonicalInt64Text(row.state_version)
  ||!exactDecimalText(row.price_decimal)||!/[1-9]/.test(row.price_decimal)||typeof row.exact_modify_available!=='boolean'||expiry===undefined
  ||legacy===undefined||sl===undefined||tp===undefined
  ||(row.exact_modify_available&&!PENDING_TYPES.includes(row.type)))throw unavailable('Invalid pending read.');
 return Object.freeze({ticket_text:row.ticket_text,account_login:want.account,symbol:typeof row.symbol==='string'?row.symbol:'',type:typeof row.type==='string'?row.type:'',
  price_decimal:row.price_decimal,sl_decimal:sl,tp_decimal:tp,state_version:row.state_version,expiry,exact_modify_available:row.exact_modify_available,legacy_modify_available:legacy});
}

export function validateExactPositionRow(value,{login,ticket}){
 const want=identity(login,ticket),row=value&&typeof value==='object'&&!Array.isArray(value)&&value.position&&typeof value.position==='object'?value.position:value;
 if(!row||typeof row!=='object'||Array.isArray(row))throw unavailable('Invalid position read.');
 const exact=row.exact_protection_available,level=key=>row[key]===null||exactDecimalText(row[key]);
 const legacy=typeof exact==='boolean'?legacyFlag(row,'legacy_protection_available',exact):undefined;
 // A fresh position has protection version 0; the state version is always positive.
 if((row.position_ticket_text??row.ticket_text)!==want.ticket||!sameAccount(row.account_login,want.account)||typeof exact!=='boolean'||legacy===undefined
  ||!canonicalInt64Text(row.state_version)||!canonicalVersionText(row.protection_version)
  ||(exact&&(!level('sl_decimal')||!level('tp_decimal')))||(!exact&&[row.sl_decimal,row.tp_decimal].some(v=>v!==undefined&&v!==null&&!exactDecimalText(v))))
  throw unavailable('Invalid position read.');
 const clean=v=>v===undefined||v===null||canonicalDecimal(v)==='0'?null:v;
 return Object.freeze({position_ticket_text:want.ticket,account_login:want.account,symbol:typeof row.symbol==='string'?row.symbol:'',
  state_version:row.state_version,protection_version:row.protection_version,sl_decimal:clean(row.sl_decimal),tp_decimal:clean(row.tp_decimal),exact_protection_available:exact,legacy_protection_available:legacy});
}

// Readback: an ACK is settled only when a fresh read shows the acknowledged version and terms.
export function pendingReadbackMatches(row,ack,input){
 if(!row||!ack||!canonicalInt64Text(ack.state_version)||row.state_version!==ack.state_version)return false;
 if(input&&Object.hasOwn(input,'price')&&!decimalEqual(row.price_decimal,input.price))return false;
 if(ack.price_decimal!==undefined&&ack.price_decimal!==null&&!decimalEqual(row.price_decimal,ack.price_decimal))return false;
 if(input&&Object.hasOwn(input,'expiry')&&row.expiry!==(input.expiry??null))return false;
 return true;
}
export function protectionReadbackMatches(row,ack,input){
 if(!row||!ack||!canonicalInt64Text(ack.protection_version)||!canonicalInt64Text(ack.state_version))return false;
 if(row.protection_version!==ack.protection_version||row.state_version!==ack.state_version)return false;
 for(const key of ['sl','tp']){
  if(!input||!Object.hasOwn(input,key))continue;
  const expected=input[key]===null||canonicalDecimal(String(input[key]))==='0'?null:input[key],actual=row[key+'_decimal'];
  if(expected===null?actual!==null:!decimalEqual(actual,expected))return false;
 }
 return true;
}

// Partial close: 0 closes all; otherwise the lots stay on the instrument grid
// and the remainder is zero or at least the minimum lot, in exact decimals.
export function closeVolumeError(requested,{current,min,step}={}){
 const text=String(requested??'').trim();
 if(text==='0')return '';
 if(!exactDecimalText(text)||!/[1-9]/.test(text))return 'Enter lots to close as an exact decimal, or 0 for the full remaining position.';
 const lots=scaled(text),known=value=>{const t=value===undefined||value===null?'':String(value);return exactDecimalText(t)&&/[1-9]/.test(t)?scaled(t):null;};
 const total=known(current),minimum=known(min),grid=known(step);
 if(total!==null&&lots>total)return 'Lots to close exceed the remaining position.';
 if(grid!==null&&lots%grid!==0n)return 'Lots to close must be a multiple of '+step+'.';
 if(minimum!==null&&lots<minimum&&(total===null||lots!==total))return 'Lots to close are below the minimum lot '+min+'.';
 if(total!==null&&minimum!==null){const rest=total-lots;if(rest!==0n&&rest<minimum)return 'The remaining position would be below the minimum lot '+min+'.';}
 return '';
}

// Route absent: a Manager binary built before B1-M/B3-M answers the row-read
// path with 405, or with 404 and no JSON error code (chi "404 page not found").
// The new route's own 404 carries PENDING_ORDER_NOT_FOUND/POSITION_NOT_FOUND and
// stays fail-closed, as do 401/403/5xx, network errors and malformed bodies.
const errorStatus=error=>error?.status??error?.response?.status;
export function rowReadRouteAbsent(error){
 const status=errorStatus(error),body=error?.body??error?.response?.data;
 if(status===405)return true;
 if(status!==404)return false;
 const code=body&&typeof body==='object'&&!Array.isArray(body)?body.error??body.code:undefined;
 return code===undefined||code===null||code==='';
}
// Pre-A5 legacy behavior for a row whose read route is absent: the legacy path
// is available (still behind the trade permission), the exact path is not, and
// the current terms and versions are unknown (undefined, never null).
const legacyFallbackPending=want=>Object.freeze({ticket_text:want.ticket,account_login:want.account,symbol:'',type:'',price_decimal:undefined,sl_decimal:undefined,tp_decimal:undefined,
 state_version:undefined,expiry:undefined,exact_modify_available:false,legacy_modify_available:true,legacy_fallback:true});
const legacyFallbackPosition=want=>Object.freeze({position_ticket_text:want.ticket,account_login:want.account,symbol:'',state_version:undefined,protection_version:undefined,
 sl_decimal:undefined,tp_decimal:undefined,exact_protection_available:false,legacy_protection_available:true,legacy_fallback:true});

// Manager-backend single-row reads (B1-M/B3-M). A route-absent answer is cached
// for this reader (one page session) per route and reported once via onRouteAbsent.
export function createExactTradeReader({request,onRouteAbsent}={}){
 if(typeof request!=='function')throw new Error('An exact read transport is required.');
 const absent=new Set();
 const read=async(kind,login,ticket,validate,fallback,signal)=>{
  const want=identity(login,ticket);let body;
  if(absent.has(kind))return fallback(want);
  try{body=await request('/api/v1/manager/accounts/'+encodeURIComponent(want.account)+'/'+kind+'/'+encodeURIComponent(want.ticket),signal);}
  catch(error){
   if(error?.name==='AbortError')throw error;
   if(!rowReadRouteAbsent(error))throw unavailable('The current trade state is unavailable.',error);
   if(!absent.has(kind)){absent.add(kind);try{onRouteAbsent?.({kind,status:errorStatus(error)});}catch{/* reporting never changes the decision */}}
   return fallback(want);
  }
  return validate(body,{login:want.account,ticket:want.ticket});
 };
 return Object.freeze({
  readPending:(login,ticket,{signal}={})=>read('pending-orders',login,ticket,validateExactPendingRow,legacyFallbackPending,signal),
  readPosition:(login,ticket,{signal}={})=>read('positions',login,ticket,validateExactPositionRow,legacyFallbackPosition,signal),
  routeAbsent:kind=>absent.has(kind),
 });
}

// Inline pending edits (Trade tab SL/TP, dealer price change) choose the path
// from a fresh server read. Exact rows send expected_version with price and
// expiry only and settle on a matching readback. Legacy rows keep the legacy
// command without a version (also a route-absent fallback row). Anything else
// fails closed before transport.
const EXACT_PENDING_FIELDS=['price','expiry'];
export function createPendingModifyRouter({reader,modifyExact,modifyLegacy}){
 if(typeof reader?.readPending!=='function'||typeof modifyExact!=='function'||typeof modifyLegacy!=='function')throw new Error('A pending read and both Modify transports are required.');
 return async({ticket,login,account_login,...changes},{permitted=true}={})=>{
  const account=account_login??login,row=await reader.readPending(account,ticket),path=pendingModifyPath(row,permitted);
  if(path==='legacy')return modifyLegacy(row.ticket_text,{...changes,account_login:account});
  if(path!=='exact')throw Object.assign(new Error('Modify is unavailable for this pending order.'),{code:'MODIFY_UNAVAILABLE'});
  if(Object.keys(changes).some(key=>!EXACT_PENDING_FIELDS.includes(key)))throw Object.assign(new Error('This exact pending order accepts only price and expiry changes. Stop loss, take profit and stop-limit price are unavailable.'),{code:'EXACT_PENDING_UNSUPPORTED'});
  const input={account_login:account,expected_version:row.state_version};
  if(Object.hasOwn(changes,'price')&&!decimalEqual(String(changes.price),row.price_decimal))input.price=String(changes.price);
  if(Object.hasOwn(changes,'expiry')&&(changes.expiry??null)!==row.expiry)input.expiry=changes.expiry??null;
  if(Object.keys(input).length===2)throw Object.assign(new Error('Change the price or expiry before submitting.'),{code:'NO_CHANGE'});
  const result=await modifyExact(row.ticket_text,input);
  if(!result?.awaiting_readback)return result;
  let fresh=null;try{fresh=await reader.readPending(account,row.ticket_text);}catch{fresh=null;}
  if(pendingReadbackMatches(fresh,result,input))return {...result,confirmed:true};
  throw Object.assign(new Error('Modify accepted, but the current pending read does not match yet. Keep command '+result.client_order_id+' and check its status before another change.'),
   {code:'MODIFY_READBACK_UNCONFIRMED',statusUnknown:true,orderWasSent:true,client_order_id:result.client_order_id,checkStatus:result.checkStatus});
 };
}
