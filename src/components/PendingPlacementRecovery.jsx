import {useEffect,useRef,useState} from 'react';
import {nativePendingPlacement} from '../services/nativePendingPlacement.js';

const textStyle={fontSize:11,fontWeight:400};
export default function PendingPlacementRecovery({login,onChanged,adapter=nativePendingPlacement}){
 const [revision,refresh]=useState(0),[records,setRecords]=useState([]),[failure,setFailure]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState('');
 const generation=useRef(0),inFlight=useRef(false);
 let scope='';try{scope=adapter.scope(login);}catch{/* Recovery still requires an authenticated matching scope. */}
 useEffect(()=>adapter.subscribe?.(()=>refresh(value=>value+1)),[adapter]);
 useEffect(()=>{generation.current++;inFlight.current=false;setBusy('');setNotice('');setFailure('');return()=>{generation.current++;};},[scope,login]);
 useEffect(()=>{try{setRecords(scope?adapter.list(login):[]);}catch(error){setRecords([]);setFailure(error.message||'Saved placement recovery is unavailable.');}},[scope,login,revision,adapter]);
 const recover=async id=>{
  if(inFlight.current||!scope)return;
  const captured=generation.current,currentScope=scope;
  const current=()=>{try{return captured===generation.current&&adapter.scope(login)===currentScope;}catch{return false;}};
  inFlight.current=true;setBusy(id);setFailure('');setNotice('Checking the original placement command.');
  try{
   const result=await adapter.recover(login,id);
   if(!current())return;
   setNotice('Original placement confirmed. Refreshing pending state.');onChanged?.(result);
  }catch(error){
   if(!current())return;
   setNotice('');setFailure(error.message||'Original placement outcome is unresolved.');
   if(adapter.isTerminal(error))onChanged?.(undefined,error);
  }finally{
   if(current()){inFlight.current=false;setBusy('');try{setRecords(adapter.list(login));}catch(error){setFailure(error.message||'Saved placement recovery is unavailable.');}}
  }
 };
 return <section aria-label="Saved pending placements" style={textStyle}>
  {records.length>0&&<><p>Saved placement commands awaiting confirmation</p><ul>{records.map(record=><li key={record.client_order_id} style={textStyle}>
   <span>{record.symbol} · {record.type} · {record.volume} lots at {record.price} · command {record.client_order_id}</span>{' '}
   <button type="button" style={textStyle} disabled={Boolean(busy)||!scope} onClick={()=>void recover(record.client_order_id)}>Check placement status</button>
  </li>)}</ul></>}
  {notice&&<p role="status">{notice}</p>}{failure&&<p role="alert">{failure}</p>}
 </section>;
}
