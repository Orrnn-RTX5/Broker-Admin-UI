import React,{useState} from 'react';
import {useAuthStore} from '../../store/authStore.js';
import {hasPermission,PERMISSION_KEYS} from '../../utils/permissions.js';
import {placeManagerOrder,closeManagerPosition} from '../../services/managerTradeApi.js';

export default function AccountTradeControls({login,ticket}){
 const user=useAuthStore(state=>state.user),closing=Boolean(ticket);
 const allowed=hasPermission(user,PERMISSION_KEYS.MANAGE_TRADES)||(closing&&hasPermission(user,PERMISSION_KEYS.CLOSE_POSITIONS));
 const [symbol,setSymbol]=useState(''),[side,setSide]=useState('buy'),[executionPolicy,setExecutionPolicy]=useState('FOK'),[volume,setVolume]=useState(closing?'0':''),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[failure,setFailure]=useState(null),[review,setReview]=useState(false);
 const execute=async(recover=false)=>{setBusy(true);setNotice('Awaiting terminal execution confirmation…');setFailure(null);try{const result=recover?await failure.checkStatus():closing?await closeManagerPosition(ticket,{account_login:login,volume}):await placeManagerOrder({login,symbol,operation:side,lots:volume,execution_policy:executionPolicy});setNotice(`${closing?'Close':'Market order'} confirmed. Command ${result.client_order_id}.`);setReview(false);}catch(error){setNotice(error.message);setFailure(error);}finally{setBusy(false);}};
 if(!allowed)return null;
 return <fieldset className="border border-white/20 p-3" style={{fontSize:11,fontWeight:400}}><legend>{closing?'Close position':'Market order'} · account {login}</legend>
  {!closing&&<><label className="block">Symbol<input className="ui-input w-full" value={symbol} disabled={busy} onChange={event=>{setReview(false);setSymbol(event.target.value);}}/></label><label className="block">Side<select className="ui-input w-full" value={side} disabled={busy} onChange={event=>{setReview(false);setSide(event.target.value);}}><option value="buy">Buy</option><option value="sell">Sell</option></select></label></>}
  {closing&&<p>Exact position ticket: {ticket}</p>}
  {!closing&&<label className="block">Requested execution policy<select className="ui-input w-full" value={executionPolicy} disabled={busy} onChange={e=>{setReview(false);setExecutionPolicy(e.target.value);}}><option>FOK</option><option>IOC</option></select><span>Effective policy is provider-derived. cServer markets use native IOC; this is not an atomic full-fill guarantee.</span></label>}
  <label className="block">{closing?'Lots to close (0 = full remaining position)':'Volume in lots'}<input className="ui-input w-full" inputMode="decimal" value={volume} disabled={busy} onChange={event=>{setReview(false);setVolume(event.target.value);}}/></label>
  {!review?<button disabled={busy||(!closing&&!symbol.trim())||volume===''} onClick={()=>setReview(true)}>Review {closing?'close':'market order'}</button>:<><p>Confirm {closing?`closing ${volume==='0'?'all remaining':volume+' lots'} of #${ticket}`:`${side.toUpperCase()} ${volume} lots of ${symbol}`} for account {login}.</p><button disabled={busy} onClick={()=>execute(false)}>Confirm {closing?'close':'market order'}</button></>}
  {notice&&<p role={failure?'alert':'status'}>{notice}</p>}
  {failure?.checkStatus&&<button disabled={busy} onClick={()=>execute(true)}>Check original command status</button>}
 </fieldset>;
}
