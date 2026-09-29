import {useCallback,useEffect,useRef,useState} from 'react';
import {useAuthStore} from '../../store/authStore.js';
import {hasPermission,PERMISSION_KEYS} from '../../utils/permissions.js';
import {modifyManagerPosition} from '../../services/managerTradeApi.js';
import {exactTradeReader} from '../../services/exactTradeRead.js';
import {protectionPath,protectionReadbackMatches,decimalEqual} from '../../services/exactTradeCapability.js';

// SL/TP edits are offered only when a fresh server read says exact_protection_available
// (exact path, settled on a matching readback) or legacy_protection_available (legacy
// non-exact position, existing path) and the operator may manipulate trades.
// Trailing is never sent from this control. A Manager backend without the row-read
// route yields a legacy_fallback row (pre-A5 behavior): legacy path, terms unknown.
const fields=[['sl','Stop loss price'],['tp','Take profit price']];
export default function PositionProtectionControls({login,ticket,canTrade=false,onChanged,reader=exactTradeReader}){
 const user=useAuthStore(state=>state.user),permitted=canTrade===true&&hasPermission(user,PERMISSION_KEYS.MANIPULATE_TRADES);
 const [values,setValues]=useState({sl:'',tp:''}),[selected,setSelected]=useState({}),[clear,setClear]=useState({}),[review,setReview]=useState(null),[reviewRoute,setReviewRoute]=useState(null),[busy,setBusy]=useState(false),[failure,setFailure]=useState(null),[notice,setNotice]=useState(''),[current,setCurrent]=useState(null),[readState,setReadState]=useState('idle');
 const generation=useRef(0),route=protectionPath(current,permitted),allowed=route!==null,locked=busy||Boolean(failure?.statusUnknown);
 const readCurrent=useCallback(async()=>{
  const run=++generation.current;setReadState('reading');
  try{const row=await reader.readPosition(login,ticket);if(run!==generation.current)return null;setCurrent(row);setReadState('ready');return row;}
  catch{if(run!==generation.current)return null;setCurrent(null);setReadState('unavailable');return null;}
 },[reader,login,ticket]);
 useEffect(()=>{const reads=generation;if(permitted&&ticket)void readCurrent();return()=>{reads.current++;};},[permitted,ticket,readCurrent]);
 const prepare=async()=>{setFailure(null);setNotice('');try{
  const before=current,fresh=await readCurrent();
  const path=protectionPath(fresh,permitted);
  if(!path)throw Error('Protection edits are unavailable for this position.');
  if(before&&(before.protection_version!==fresh.protection_version||before.state_version!==fresh.state_version||protectionPath(before,permitted)!==path))throw Error('The position protection changed. Review its current terms again.');
  const input={account_login:login};
  for(const [key]of fields){if(!selected[key])continue;const value=clear[key]?null:values[key],now=fresh[key+'_decimal'];if(value===null?now===null:decimalEqual(value,now))continue;input[key]=value;}
  if(Object.keys(input).length===1)throw Error('Change the stop loss or take profit before review.');
  setReview(input);setReviewRoute(path);
 }catch(error){setFailure(error);setNotice(error.message);}};
 const settle=async(result,input)=>{
  setNotice('Accepted; confirming with a fresh position read.');
  let row=null;try{row=await reader.readPosition(login,ticket);setCurrent(row);}catch{row=null;}
  if(protectionReadbackMatches(row,result,input)){setNotice('Position protections confirmed by readback. Protection version '+row.protection_version+'. Command '+result.client_order_id+'.');setReview(null);setSelected({});setClear({});onChanged?.();return;}
  const error=Object.assign(new Error('Protection change accepted, but the current position read does not match yet. Keep command '+result.client_order_id+' and check its status before another change.'),{statusUnknown:true,checkStatus:result.checkStatus,readbackInput:input,client_order_id:result.client_order_id});
  setFailure(error);setNotice(error.message);
 };
 // Legacy positions settle on the terminal outcome, as before; the fresh read only refreshes the display.
 const legacySettle=async(result,input)=>{
  let row=null;try{row=await reader.readPosition(login,ticket);setCurrent(row);}catch{row=null;}
  const shown=row&&fields.every(([key])=>!Object.hasOwn(input,key)||(input[key]===null?row[key+'_decimal']===null:decimalEqual(input[key],row[key+'_decimal'])));
  setNotice((shown?'Position protections updated and shown by the current position read.':'Position protections updated.')+' Command '+result.client_order_id+'.');setReview(null);setSelected({});setClear({});onChanged?.();
 };
 const execute=async recover=>{setBusy(true);setNotice('Waiting for durable protection confirmation.');const prior=failure,input=recover?prior.readbackInput:review,path=recover?prior.route:reviewRoute;setFailure(null);
  try{const result=recover?await prior.checkStatus():await modifyManagerPosition(ticket,review);await (path==='legacy'?legacySettle:settle)(result,input);}
  catch(error){if(input&&!error.readbackInput)error.readbackInput=input;if(!error.route)error.route=path;setFailure(error);setNotice(error.message);}
  finally{setBusy(false);}};
 const edit=(setter,state,key,value)=>{setReview(null);setter({...state,[key]:value});};
 return <fieldset className="position-protection-controls" style={{fontSize:11,fontWeight:400,border:'1px solid #666',padding:10,minWidth:0}}><legend>Position protections - account {login}, ticket {ticket}</legend>
  {!permitted&&<p>Trade manipulation permission is required to change protections.</p>}
  {permitted&&readState==='reading'&&<p role="status">Reading the current position…</p>}
  {permitted&&(readState==='unavailable'||(readState==='ready'&&!allowed))&&<p role="status">Protection edits are unavailable for this position.</p>}
  {allowed&&<>{current.legacy_fallback?<p role="status">Current protections are unavailable: this Manager backend has no position read. Legacy path only; every selected field is sent.</p>:<p>Current stop loss {current.sl_decimal??'none'}, take profit {current.tp_decimal??'none'}; position version {current.state_version}, protection version {current.protection_version}.</p>}
   <p>Unselected fields stay unchanged. Clear removes the selected protection. Trailing is not available here. {route==='exact'?'Success is shown only after a matching position read.':'Legacy position: changes use the existing protection path.'}</p>
   <fieldset disabled={locked} style={{border:0,padding:0}}>{fields.map(([key,label])=><div key={key} style={{display:'flex',flexWrap:'wrap',gap:8,alignItems:'center',marginBottom:6}}><label><input type="checkbox" checked={Boolean(selected[key])} onChange={e=>edit(setSelected,selected,key,e.target.checked)}/>Change {label}</label><label>{label}<input aria-label={label} inputMode="decimal" disabled={!selected[key]||clear[key]} value={values[key]} onChange={e=>edit(setValues,values,key,e.target.value)}/></label><label><input type="checkbox" checked={Boolean(clear[key])} disabled={!selected[key]} onChange={e=>edit(setClear,clear,key,e.target.checked)}/>Clear {label}</label></div>)}
    <button type="button" onClick={prepare}>Review position protections</button>
    {review&&<div><p>Confirm protection changes for exact ticket {ticket}{current.legacy_fallback?'':' at protection version '+current.protection_version}: {fields.filter(([key])=>Object.hasOwn(review,key)).map(([key,label])=>label+' = '+(review[key]===null?'clear':review[key])).join(', ')}.</p><button type="button" onClick={()=>execute(false)}>Confirm position protections</button></div>}
   </fieldset></>}
  {notice&&<p role={failure?'alert':'status'}>{notice}</p>}{failure?.checkStatus&&<button type="button" disabled={busy} onClick={()=>execute(true)}>Check original protection command</button>}
 </fieldset>;
}
