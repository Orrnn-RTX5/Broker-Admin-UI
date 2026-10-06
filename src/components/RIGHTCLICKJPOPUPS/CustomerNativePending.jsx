import NativePendingCancelControls from '../NativePendingCancelControls.jsx';
import {useEffect,useState} from 'react';
import NativePendingPlacementForm from '../NativePendingPlacementForm.jsx';
import PendingPlacementRecovery from '../PendingPlacementRecovery.jsx';
import {readCustomerPending,nativePendingLabels} from '../../services/customerPending.js';
import {startAdminStateFeed} from '../../services/adminStateFeed.js';
export default function CustomerNativePending({login,canCancel=false,canPlace=false}){
 const [state,setState]=useState({orders:[],truncated:false,error:'',loading:true});
 const [revision,refresh]=useState(0);
 const [outcome,setOutcome]=useState(null);
 useEffect(()=>setOutcome(null),[login]);
 useEffect(()=>{
  let active=true;let running=false;let queued=false;const controller=new AbortController();
  setState({orders:[],truncated:false,error:'',loading:true});
  const load=async()=>{if(!active||!login)return;if(running){queued=true;return;}running=true;try{const data=await readCustomerPending(login,{signal:controller.signal});if(active)setState({...data,error:'',loading:false});}catch(error){if(active)setState({orders:[],truncated:false,error:'Pending state unavailable or access revoked.',loading:false});}finally{running=false;if(queued&&active){queued=false;void load();}}};
  if(login)void load();else setState({orders:[],truncated:false,error:'Select an account.',loading:false});
  const timer=setInterval(()=>{if(document.visibilityState==='visible')void load();},10000);
  const focus=()=>void load();const events=['focus','manager:refresh-data','rtx:trade-modified','admin:state-changed','rtx:new-trade-placed','rtx:pending-placement-changed'];events.forEach(event=>window.addEventListener(event,focus));
  const stopFeed=login?startAdminStateFeed():()=>{};
  return()=>{active=false;controller.abort();stopFeed();clearInterval(timer);events.forEach(event=>window.removeEventListener(event,focus));};
 },[login,revision]);
 return <section aria-label="Native pending orders" style={{fontSize:11,fontWeight:400,overflowX:'auto',padding:8}}>
 <div>Native pending orders <button style={{fontSize:11,fontWeight:400}} type="button" onClick={()=>refresh(n=>n+1)}>Refresh native pending</button></div>
 <PendingPlacementRecovery login={login} onChanged={()=>refresh(n=>n+1)}/>
 <NativePendingPlacementForm login={login} canPlace={canPlace} onChanged={()=>refresh(n=>n+1)}/>
 <p>Native execution is separate from customer settlement. Cancellation is available only for verified eligible orders. Existing commands can be checked by their original identity.</p>
 {state.loading&&<p>Loading native pending state.</p>}{state.error&&<p role="alert">{state.error}</p>}
 {outcome&&<p role={outcome.error?'alert':'status'}>{outcome.message}</p>}
 <table style={{fontSize:11,fontWeight:400,textAlign:'left',borderCollapse:'collapse'}}><thead><tr>{['Command / ticket','Symbol / type','Customer volume (raw)','Customer lots','Original customer price','Lifecycle','Customer state','Expiry','Cancellation'].map(label=><th style={{fontWeight:400,padding:4}} key={label}>{label}</th>)}</tr></thead>
 <tbody>{state.orders.map(row=><tr key={'lp_native:'+row.command_id} data-execution-owner="lp_native"><td style={{padding:'4px 6px',whiteSpace:'nowrap'}}>{row.command_id} / {row.order_ticket??'No customer ticket'}</td><td style={{padding:'4px 6px',whiteSpace:'nowrap'}}>{row.symbol} / {row.order_type}</td><td style={{padding:'4px 6px',whiteSpace:'nowrap'}}>{row.raw_customer_volume}</td><td style={{padding:'4px 6px',whiteSpace:'nowrap'}}>{row.customer_lots}</td><td style={{padding:'4px 6px',whiteSpace:'nowrap'}}>{row.customer_price}</td><td style={{padding:'4px 6px',whiteSpace:'nowrap'}}>{nativePendingLabels[row.display_state]}{row.reconciliation_required?' - Reconciliation required':''}</td><td style={{padding:'4px 6px',whiteSpace:'nowrap'}}>{row.customer_status}</td><td style={{padding:'4px 6px',whiteSpace:'nowrap'}}>{row.expiry===null?'GTC':new Date(row.expiry*1000).toISOString()}</td><td style={{padding:4}}><NativePendingCancelControls login={login} row={row} canCancel={canCancel} onChanged={(result,error)=>{setOutcome({error:Boolean(error),message:error?.message||'Original pending command confirmed.'});refresh(n=>n+1);}}/></td></tr>)}</tbody></table>
 {!state.loading&&!state.error&&!state.orders.length&&<p>No native pending records for this account.</p>}
 {state.truncated&&<p>Showing the latest 100 native pending records. Older records are not included.</p>}
 </section>;
}
