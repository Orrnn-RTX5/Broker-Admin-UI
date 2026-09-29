import { useCallback, useEffect, useRef, useState } from 'react';
import './pending-trade-controls.css';
import {useAuthStore} from '../../store/authStore.js';
import {hasPermission,PERMISSION_KEYS} from '../../utils/permissions.js';
import { placeManagerPendingOrder, cancelManagerPendingOrder, modifyManagerPendingOrder, modifyManagerLegacyPendingOrder } from '../../services/managerTradeApi.js';
import { exactTradeReader } from '../../services/exactTradeRead.js';
import { pendingModifyPath, pendingReadbackMatches, decimalEqual } from '../../services/exactTradeCapability.js';

// Modify is offered only when a fresh server read says exact_modify_available or
// legacy_modify_available and the operator may manipulate trades. The exact path
// sends expected_version, price and expiry only and settles on readback. The legacy
// path (non-exact rows) keeps the legacy command: price, SL/TP and expiry, no version.
// A Manager backend without the row-read route yields a legacy_fallback row (pre-A5
// behavior): legacy Modify only, current terms unknown, so selected fields are sent.
export default function PendingTradeControls({login,ticket,canTrade,canCancel,canModify,onChanged,reader=exactTradeReader}) {
 const user=useAuthStore(state=>state.user);canTrade??=hasPermission(user,PERMISSION_KEYS.MANAGE_TRADES);canCancel??=canTrade||hasPermission(user,PERMISSION_KEYS.CLOSE_POSITIONS);canModify??=canTrade&&hasPermission(user,PERMISSION_KEYS.MANIPULATE_TRADES);
 const [target,setTarget]=useState(ticket||''),[symbol,setSymbol]=useState(''),[type,setType]=useState('buy_limit'),[volume,setVolume]=useState(''),[price,setPrice]=useState(''),[sl,setSL]=useState(''),[tp,setTP]=useState(''),[expiryMode,setExpiryMode]=useState('keep'),[expiry,setExpiry]=useState(''),[changes,setChanges]=useState({}),[review,setReview]=useState(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[failure,setFailure]=useState(null),[current,setCurrent]=useState(null),[readState,setReadState]=useState('idle');
 const effectiveTicket=ticket||target,editing=Boolean(effectiveTicket),generation=useRef(0);
 const route=editing?pendingModifyPath(current,canModify===true):null,modifiable=route!==null;
 const change=(setter,value)=>{setReview(null);setter(value);};
 const readCurrent=useCallback(async()=>{
  const run=++generation.current;setReadState('reading');
  try{const row=await reader.readPending(login,effectiveTicket);if(run!==generation.current)return null;setCurrent(row);setReadState('ready');return row;}
  catch{if(run!==generation.current)return null;setCurrent(null);setReadState('unavailable');return null;}
 },[reader,login,effectiveTicket]);
 useEffect(()=>{const reads=generation;if(ticket&&canModify===true)void readCurrent();return()=>{reads.current++;};},[ticket,canModify,readCurrent]);
 const expiryInput=input=>{if(expiryMode==='keep')return;if(expiryMode==='gtc'){input.expiry=null;return;}if(!/^[1-9]\d*$/.test(expiry)||!Number.isSafeInteger(Number(expiry)))throw Error('Enter UTC expiry as exact Unix seconds.');input.expiry=Number(expiry);};
 const legacyLevels=(input,fresh)=>{for(const [key,value,now]of [['sl',sl,fresh.sl_decimal],['tp',tp,fresh.tp_decimal]]){if(!changes[key])continue;const next=value.trim()===''?null:value.trim();if(next===null?now===null:decimalEqual(next,now))continue;input[key]=next;}};
 const prepare=async action=>{setFailure(null);setNotice('');try{const input={account_login:login};let reviewAction=action;
   if(action==='place'){Object.assign(input,{symbol,type,volume,price});if(sl!=='')input.sl=sl;if(tp!=='')input.tp=tp;expiryInput(input);}
   else if(action==='modify'){
    const before=current,fresh=await readCurrent(),path=pendingModifyPath(fresh,canModify===true);
    if(!path)throw Error('Modify is unavailable for this pending order.');
    if(before&&(before.state_version!==fresh.state_version||pendingModifyPath(before,canModify===true)!==path))throw Error('The pending order changed. Review its current terms again.');
    if(path==='exact')input.expected_version=fresh.state_version;
    if(changes.price&&!decimalEqual(price,fresh.price_decimal))input.price=price;
    if(path==='legacy')legacyLevels(input,fresh);
    expiryInput(input);if(Object.hasOwn(input,'expiry')&&input.expiry===fresh.expiry)delete input.expiry;
    if(!['price','sl','tp','expiry'].some(key=>Object.hasOwn(input,key)))throw Error(path==='exact'?'Change the price or expiry before review.':'Change the price, stop loss, take profit or expiry before review.');
    reviewAction=path==='exact'?'modify':'legacy modify';
   }
   setReview({action:reviewAction,input,ticket:effectiveTicket});
  }catch(error){setNotice(error.message);setFailure(error);}};
 const settle=async(result,input)=>{
  setNotice('Modify accepted; confirming with a fresh pending read.');
  let row=null;try{row=await reader.readPending(login,effectiveTicket);setCurrent(row);}catch{row=null;}
  if(pendingReadbackMatches(row,result,input)){setNotice(`Pending modification confirmed by readback. Ticket ${row.ticket_text}, version ${row.state_version}. Command ${result.client_order_id}.`);setReview(null);setChanges({});onChanged?.(result);return;}
  const error=Object.assign(new Error(`Modify accepted, but the current pending read does not match yet. Keep command ${result.client_order_id} and check its status before another change.`),{statusUnknown:true,checkStatus:result.checkStatus,readbackInput:input,client_order_id:result.client_order_id});
  setFailure(error);setNotice(error.message);
 };
 const execute=async recover=>{setBusy(true);setNotice('Awaiting the original command outcome.');const prior=failure,pendingReview=review;setFailure(null);
  try{const result=recover?await prior.checkStatus():pendingReview.action==='place'?await placeManagerPendingOrder(pendingReview.input):pendingReview.action==='cancel'?await cancelManagerPendingOrder(pendingReview.ticket,pendingReview.input):pendingReview.action==='legacy modify'?await modifyManagerLegacyPendingOrder(pendingReview.ticket,pendingReview.input):await modifyManagerPendingOrder(pendingReview.ticket,pendingReview.input);
   if(result?.awaiting_readback){await settle(result,recover?prior.readbackInput:pendingReview.input);return;}
   setNotice(`Pending command confirmed. Ticket ${result.ticket_text||result.ticket}. Command ${result.client_order_id}.`);if(!editing)setTarget(result.ticket_text||result.ticket);if(editing&&(recover||pendingReview?.action==='legacy modify'))void readCurrent();setReview(null);setChanges({});onChanged?.(result);}
  catch(error){if(!recover&&pendingReview?.action==='modify')error.readbackInput=pendingReview.input;else if(recover&&prior?.readbackInput&&!error.readbackInput)error.readbackInput=prior.readbackInput;setNotice(error.message);setFailure(error);}
  finally{setBusy(false);}};
 if(!canTrade&&!canCancel&&!canModify)return null;
 const locked=busy||Boolean(failure?.statusUnknown);
 return <fieldset className="pending-trade-controls" aria-label="Pending order controls" style={{fontSize:11,fontWeight:400,margin:'10px 0',padding:10,border:'1px solid #7b899c',borderRadius:4}}>
  <legend style={{fontSize:11,fontWeight:400}}>Pending orders · account {login}</legend>
  <p>Placement confirms a working order, not a fill. Stop-limit and trailing changes are unavailable.</p>
  {!ticket&&<label style={{display:'block'}}>Manage existing exact ticket (blank to place)<input aria-label="Pending ticket" value={target} disabled={locked} onChange={e=>{setCurrent(null);setReadState('idle');change(setTarget,e.target.value);}} style={{width:'100%'}}/></label>}
  {editing?<p>Exact pending ticket: {effectiveTicket}</p>:<><label style={{display:'block'}}>Symbol<input aria-label="Pending symbol" value={symbol} disabled={busy} onChange={e=>change(setSymbol,e.target.value)} style={{width:'100%'}}/></label><label style={{display:'block'}}>Type<select aria-label="Pending type" value={type} disabled={busy} onChange={e=>change(setType,e.target.value)} style={{width:'100%'}}>{['buy_limit','sell_limit','buy_stop','sell_stop'].map(value=><option key={value} value={value}>{value.replaceAll('_',' ')}</option>)}</select></label><label style={{display:'block'}}>Volume in lots<input aria-label="Pending volume" inputMode="decimal" value={volume} disabled={busy} onChange={e=>change(setVolume,e.target.value)} style={{width:'100%'}}/></label></>}
  {!editing&&canTrade&&<><div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:8}}>{[['price','Trigger / limit price',price,setPrice],['sl','Stop loss',sl,setSL],['tp','Take profit',tp,setTP]].map(([key,label,value,setter])=><label key={key}>{label}<input aria-label={'Pending '+key} inputMode="decimal" value={value} disabled={busy} onChange={e=>change(setter,e.target.value)} style={{width:'100%'}}/></label>)}</div>
   <label>Expiry<select aria-label="Pending expiry mode" value={expiryMode} disabled={busy} onChange={e=>change(setExpiryMode,e.target.value)}><option value="keep">GTC (no expiry)</option><option value="gtc">GTC (clear expiry)</option><option value="gtd">GTD (UTC Unix seconds)</option></select></label>{expiryMode==='gtd'&&<input aria-label="Pending expiry seconds" inputMode="numeric" value={expiry} disabled={busy} onChange={e=>change(setExpiry,e.target.value)}/>}
  </>}
  {editing&&canModify===true&&<section aria-label="Pending Modify availability">
   {readState==='reading'&&<p role="status">Reading the current pending order…</p>}
   {readState==='unavailable'&&<p role="status">The current pending order could not be read. Modify is unavailable.</p>}
   {readState==='ready'&&current&&(current.legacy_fallback?<p role="status">Current terms are unavailable: this Manager backend has no pending-order read. Legacy Modify only; every selected field is sent without an exact version.</p>:<p>Current price {current.price_decimal}, stop loss {current.sl_decimal??'none'}, take profit {current.tp_decimal??'none'}, expiry {current.expiry===null?'GTC':current.expiry+' (UTC seconds)'}, version {current.state_version}.</p>)}
   {readState==='ready'&&current&&!modifiable&&<p role="status">Modify is unavailable for this pending order.</p>}
   {!ticket&&<button type="button" disabled={locked||readState==='reading'} onClick={()=>{setReview(null);void readCurrent();}}>Read current pending order</button>}
  </section>}
  {modifiable&&<><label style={{display:'block'}}><input type="checkbox" aria-label="Change Trigger / limit price" checked={Boolean(changes.price)} disabled={locked} onChange={e=>change(setChanges,{...changes,price:e.target.checked})}/> Trigger / limit price<input aria-label="Pending price" inputMode="decimal" value={price} disabled={locked||!changes.price} onChange={e=>change(setPrice,e.target.value)} style={{width:'100%'}}/></label>
   <label>Expiry<select aria-label="Pending expiry mode" value={expiryMode} disabled={locked} onChange={e=>change(setExpiryMode,e.target.value)}><option value="keep">Keep expiry</option><option value="gtc">GTC (clear expiry)</option><option value="gtd">GTD (UTC Unix seconds)</option></select></label>{expiryMode==='gtd'&&<input aria-label="Pending expiry seconds" inputMode="numeric" value={expiry} disabled={locked} onChange={e=>change(setExpiry,e.target.value)}/>}
   {route==='legacy'&&[['sl','Stop loss',sl,setSL],['tp','Take profit',tp,setTP]].map(([key,label,value,setter])=><label key={key} style={{display:'block'}}><input type="checkbox" aria-label={'Change '+label} checked={Boolean(changes[key])} disabled={locked} onChange={e=>change(setChanges,{...changes,[key]:e.target.checked})}/> {label} (blank clears)<input aria-label={'Pending '+key} inputMode="decimal" value={value} disabled={locked||!changes[key]} onChange={e=>change(setter,e.target.value)} style={{width:'100%'}}/></label>)}
   {route==='exact'?<p>Stop loss, take profit, stop-limit price and trailing are not changed by Modify.</p>:<p>Legacy account order: Modify uses the existing path without an exact version. Stop-limit price and trailing are not changed.</p>}
  </>}
  <div style={{display:'flex',gap:8,marginTop:8}}>{!editing&&canTrade&&<button type="button" disabled={locked} onClick={()=>prepare('place')}>Review pending placement</button>}{modifiable&&<button type="button" disabled={locked} onClick={()=>prepare('modify')}>Review pending changes</button>}{editing&&canCancel&&<button type="button" disabled={locked} onClick={()=>prepare('cancel')}>Review pending cancellation</button>}</div>
  {review&&<div><p>Confirm {review.action} for account {login}{review.ticket?`, ticket ${review.ticket}`:`: ${type} ${volume} lots of ${symbol} at ${price}`}.{review.action==='legacy modify'&&`${['price','sl','tp'].filter(key=>Object.hasOwn(review.input,key)).map(key=>` ${key==='price'?'Price':key.toUpperCase()} ${review.input[key]??'clear'}.`).join('')}${Object.hasOwn(review.input,'expiry')?` Expiry ${review.input.expiry===null?'GTC':review.input.expiry}.`:''}`}{review.action==='modify'&&` Expected version ${review.input.expected_version}.${Object.hasOwn(review.input,'price')?` Price ${review.input.price}.`:''}${Object.hasOwn(review.input,'expiry')?` Expiry ${review.input.expiry===null?'GTC':review.input.expiry}.`:''}`}</p><button type="button" disabled={busy} onClick={()=>execute(false)}>Confirm pending {review.action}</button></div>}
  {notice&&<p role={failure?'alert':'status'}>{notice}</p>}{failure?.checkStatus&&<button type="button" disabled={busy} onClick={()=>execute(true)}>Check original pending command</button>}
 </fieldset>;
}
