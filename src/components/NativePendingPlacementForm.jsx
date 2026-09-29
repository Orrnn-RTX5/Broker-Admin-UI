import {useEffect,useRef,useState} from 'react';
import {nativePendingPlacement} from '../services/nativePendingPlacement.js';
import {nativePendingUTCExpiry,normalizeNativePendingDraft,matchingSavedPlacement,validateNativePendingAdvisory} from '../services/nativePendingAdvisory.js';

const style={fontSize:11,fontWeight:400};
export default function NativePendingPlacementForm({login,canPlace=false,onChanged,adapter=nativePendingPlacement}){
 const [symbol,setSymbol]=useState(''),[type,setType]=useState('buy_limit'),[volume,setVolume]=useState(''),[price,setPrice]=useState(''),[tif,setTif]=useState('GTC'),[expiry,setExpiry]=useState('');
 const [phase,setPhase]=useState(''),[notice,setNotice]=useState(''),[failure,setFailure]=useState(''),[,sessionChanged]=useState(0);
 const generation=useRef(0),operation=useRef(null),permission=useRef(canPlace);permission.current=canPlace;
 let scope='';try{scope=adapter.scope(login);}catch{/* No current submission scope. */}
 const stop=()=>{generation.current++;operation.current?.abort();operation.current=null;setPhase('');};
 useEffect(()=>adapter.subscribe?.(()=>sessionChanged(n=>n+1)),[adapter]);
 useEffect(()=>{stop();setNotice('');setFailure('');return()=>{generation.current++;operation.current?.abort();operation.current=null;};},[scope,login]);
 useEffect(()=>{if(!canPlace)stop();},[canPlace]);
 const edit=(setter,value)=>{stop();setter(value);setNotice('');setFailure('');};
 const submit=async event=>{
  event.preventDefault();if(operation.current||!canPlace||!scope)return;
  setFailure('');setNotice('');
  let draft;
  try{
   const input={account_login:Number(login),symbol,type,volume,price};
   if(tif==='GTD'){input.expiry=nativePendingUTCExpiry(expiry);if(input.expiry*1000<=Date.now())throw Error('GTD expiry must be in the future.');}
   draft=Object.freeze(normalizeNativePendingDraft(input));
   const saved=matchingSavedPlacement(adapter.list(login),draft);
   if(saved)throw Error('Check saved placement '+saved.client_order_id+' in the recovery section before another matching order.');
  }catch(error){setFailure(error.message);return;}
  const controller=new AbortController(),captured=++generation.current,currentScope=scope;
  operation.current=controller;setPhase('checking');setNotice('Checking this native placement draft.');
  const current=()=>{try{return !controller.signal.aborted&&generation.current===captured&&permission.current&&adapter.scope(login)===currentScope;}catch{return false;}};
  try{
   const startedAt=Date.now(),response=await adapter.check(draft,{signal:controller.signal});
   if(!current())return;
   const advisory=await validateNativePendingAdvisory(response,draft,{startedAt});
   if(!current())return;
   if(!advisory.available)throw Error('Native placement unavailable for this draft ('+advisory.reason+').');
   const saved=matchingSavedPlacement(adapter.list(login),draft);
   if(saved)throw Error('Check saved placement '+saved.client_order_id+' in the recovery section before another matching order.');
   if(advisory.validUntil<=Date.now())throw Error('The placement check expired. Submit again to obtain a fresh check.');
   setPhase('sending');setNotice('Awaiting the original placement command outcome.');
   const result=await adapter.place({...draft,require_native:true});
   if(!current())return;
   setNotice('Placement command confirmed. Refreshing native pending state.');onChanged?.(result);
  }catch(error){
   if(!current())return;
   setNotice('');setFailure(error.message||'Placement outcome is unavailable. Check saved placements for the original command.');
   if(adapter.isTerminal(error))onChanged?.(undefined,error);
  }finally{if(operation.current===controller){operation.current=null;setPhase('');}}
 };
 if(!canPlace||!scope)return null;
 return <form aria-label="Native pending placement" onSubmit={submit} style={style}>
  <fieldset style={style}><legend style={style}>Native pending placement</legend>
   <p>Limit or stop placement confirms a pending order. Customer execution is shown separately. Attached protection, stop-limit and trailing terms are unavailable.</p>
   <label>Symbol <input aria-label="Native pending symbol" value={symbol} disabled={phase==='sending'} onChange={event=>edit(setSymbol,event.target.value)} style={style}/></label>
   <label>Type <select aria-label="Native pending type" value={type} disabled={phase==='sending'} onChange={event=>edit(setType,event.target.value)} style={style}>{['buy_limit','sell_limit','buy_stop','sell_stop'].map(value=><option key={value} value={value}>{value.replaceAll('_',' ')}</option>)}</select></label>
   <label>Volume <input aria-label="Native pending volume" inputMode="decimal" value={volume} disabled={phase==='sending'} onChange={event=>edit(setVolume,event.target.value)} style={style}/></label>
   <label>Customer price <input aria-label="Native pending price" inputMode="decimal" value={price} disabled={phase==='sending'} onChange={event=>edit(setPrice,event.target.value)} style={style}/></label>
   <label>Time in force <select aria-label="Native pending time in force" value={tif} disabled={phase==='sending'} onChange={event=>edit(setTif,event.target.value)} style={style}><option>GTC</option><option>GTD</option></select></label>
   {tif==='GTD'&&<label>Expiry date and time (UTC) <input aria-label="Native pending expiry" type="datetime-local" step="1" value={expiry} disabled={phase==='sending'} onChange={event=>edit(setExpiry,event.target.value)} style={style}/></label>}
   <button type="submit" style={style} disabled={Boolean(phase)}>Check and place native order</button>
   {notice&&<p role="status">{notice}</p>}{failure&&<p role="alert">{failure}</p>}
  </fieldset>
 </form>;
}
