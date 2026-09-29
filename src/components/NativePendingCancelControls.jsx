import {useEffect,useRef,useState} from 'react';
import {nativePendingCancel} from '../services/nativePendingCancel.js';

const textStyle={fontSize:11,fontWeight:400};
export default function NativePendingCancelControls({login,row,canCancel=false,onChanged,adapter=nativePendingCancel}){
 const [,sessionChanged]=useState(0);
 const [recovery,setRecovery]=useState(null),[failure,setFailure]=useState(''),[notice,setNotice]=useState(''),[review,setReview]=useState(false),[busy,setBusy]=useState(false);
 const generation=useRef(0),inFlight=useRef(false);
 let scope='';try{scope=adapter.scope(login);}catch{/* Fail closed for fresh actions. */}
 const ticket=row.order_ticket;
 const readRecovery=()=>{if(!scope||!ticket)return {record:null,error:''};try{return {record:adapter.peek(login,ticket),error:''};}catch(error){return {record:null,error:error.message||'Original command recovery is unavailable.'};}};
 useEffect(()=>adapter.subscribe?.(()=>sessionChanged(n=>n+1)),[adapter]);
 useEffect(()=>{generation.current++;inFlight.current=false;setBusy(false);setReview(false);setNotice('');return()=>{generation.current++;};},[scope,login,ticket]);
 useEffect(()=>{const saved=readRecovery();setRecovery(saved.record);setFailure(saved.error);},[scope,login,ticket,row.revision]);
 const freshAllowed=Boolean(scope&&ticket&&canCancel&&row.cancel_available===true&&!recovery&&!failure);
 const execute=async statusOnly=>{
  if(inFlight.current)return;
  const saved=readRecovery();
  if(saved.error){setFailure(saved.error);return;}
  if(statusOnly&&!saved.record){setRecovery(null);setFailure('Original command identity is required for recovery.');return;}
  if(!statusOnly&&(!freshAllowed||saved.record)){setRecovery(saved.record);setReview(false);return;}
  const captured=generation.current,currentScope=scope;
  const current=()=>{try{return captured===generation.current&&adapter.scope(login)===currentScope;}catch{return false;}};
  inFlight.current=true;setBusy(true);setReview(false);setFailure('');setNotice('Awaiting the original command outcome.');
  try{
   const result=statusOnly?await adapter.recover(login,ticket,saved.record.client_order_id):await adapter.cancel(login,ticket);
   if(!current())return;
   setRecovery(null);setNotice(statusOnly?'Original pending command confirmed.':'Cancellation confirmed.');onChanged?.(result);
  }catch(error){
   if(!current())return;
   setFailure(error.message||'Command outcome is unavailable.');setNotice('');
   const latest=readRecovery();setRecovery(latest.record);
   if(latest.error)setFailure(latest.error);
   if(adapter.isTerminal(error))onChanged?.(undefined,error);
  }finally{if(current()){inFlight.current=false;setBusy(false);}}
 };
 return <div style={textStyle}>
  {freshAllowed&&<button type="button" style={textStyle} disabled={busy} onClick={()=>setReview(true)} aria-label={'Cancel native order '+ticket}>Cancel</button>}
  {review&&freshAllowed&&<div><p>Cancel ticket {ticket} for account {login}?</p><button type="button" style={textStyle} disabled={busy} onClick={()=>void execute(false)}>Confirm cancellation</button><button type="button" style={textStyle} disabled={busy} onClick={()=>setReview(false)}>Keep order</button></div>}
  {recovery&&<div><p>Unresolved command {recovery.client_order_id}.</p><button type="button" style={textStyle} disabled={busy||!scope} onClick={()=>void execute(true)}>Check status</button></div>}
  {notice&&<p role="status">{notice}</p>}{failure&&<p role="alert">{failure}</p>}
 </div>;
}
