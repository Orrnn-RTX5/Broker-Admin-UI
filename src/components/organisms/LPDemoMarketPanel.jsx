import {useEffect,useRef,useState} from 'react';
import {previewDemoMarket} from '../../services/lpDemoMarketApi.js';
import {demoMarketCommand,demoMarketError,demoPreviewCurrent} from '../../services/lpDemoMarket.js';
import {placeManagerOrder,listManagerDemoOrders,recoverManagerDemoOrder,closeManagerDemoPosition,listManagerDemoCloses,recoverManagerDemoClose,getManagerTradeScope} from '../../services/managerTradeApi.js';
import './lp-demo-market.css';

export default function LPDemoMarketPanel({sessionKey,canPreview=true}){
 const [draft,setDraft]=useState({account_login:'',symbol:'',side:'buy',volume:'',execution_policy:'IOC'});
 const [preview,setPreview]=useState(null),[pending,setPending]=useState([]),[result,setResult]=useState(null),[closeID,setCloseID]=useState('');
 const [pendingCloses,setPendingCloses]=useState([]),[retryClose,setRetryClose]=useState(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[now,setNow]=useState(Date.now);
 const generation=useRef(0),inFlight=useRef(false);
 const refreshPending=()=>{if(!/^[1-9][0-9]*$/.test(draft.account_login)){setPending([]);setPendingCloses([]);return;}setPending(listManagerDemoOrders(draft.account_login));setPendingCloses(listManagerDemoCloses(draft.account_login));};
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),500);return()=>clearInterval(timer);},[]);
 useEffect(()=>{generation.current++;inFlight.current=false;setPreview(null);setResult(null);setCloseID('');setRetryClose(null);setNotice('');setError('');setBusy(false);try{refreshPending();}catch(e){setError(e.message);}return()=>{generation.current++;};},[sessionKey,draft.account_login]);
 useEffect(()=>{if(!canPreview)setPreview(null);},[canPreview]);
 const run=async (operation,onError,onSuccess)=>{
  if(inFlight.current)return;
  inFlight.current=true;
  const token=++generation.current,scope=getManagerTradeScope();setBusy(true);setError('');setNotice('');
  try{const value=await operation();if(token!==generation.current||scope!==getManagerTradeScope())return;onSuccess?.(value);return value;}
  catch(e){if(token===generation.current&&scope===getManagerTradeScope()){onError?.(e);setError(e.message||'The request could not be completed.');if(e.statusUnknown)setNotice('Execution is unresolved. Check the original command before another order.');}return undefined;}
  finally{if(token===generation.current&&scope===getManagerTradeScope()){inFlight.current=false;setBusy(false);try{refreshPending();}catch(e){setError(e.message);}}}
 };
 const update=(key,value)=>{setDraft(old=>({...old,[key]:value}));setPreview(null);setError('');setNotice('');};
 const inspect=async event=>{event.preventDefault();setPreview(null);const value=await run(()=>previewDemoMarket(draft));if(value){setPreview(value);if(!value.ready)setError(demoMarketError(value.reason));}};
 const submit=async()=>{
  if(!canPreview||pending.length||pendingCloses.length||result||!demoPreviewCurrent(preview))return;
  const value=await run(async()=>{const payload=demoMarketCommand(preview);setPreview(null);return placeManagerOrder(payload);});
  if(value){setResult(value);setNotice('Demo order filled. Review the position and close it when ready.');}
 };
 const recover=async id=>{const value=await run(()=>recoverManagerDemoOrder(draft.account_login,id));if(value){setResult(value);setNotice('The original demo order is filled. No new order was submitted.');}};
 const closeError=e=>{if(e.commandStatus==='rejected'||e.commandStatus==='expired')setCloseID('');else if(e.statusUnknown)setCloseID(e.client_order_id);};
 const close=async()=>{
  if(!result?.position_ticket||result.closed)return;
  await run(()=>closeID?recoverManagerDemoClose(result.account_login,closeID):closeManagerDemoPosition(result.position_ticket,{account_login:result.account_login,volume:0}),closeError,value=>{setResult(old=>({...old,closed:true,close_client_order_id:value.client_order_id}));setCloseID('');setNotice('Position close confirmed. Review the execution journal and account balances.');});
 };
 const recoverClose=async item=>{
  await run(()=>recoverManagerDemoClose(draft.account_login,item.client_order_id),e=>{closeError(e);if(e.commandStatus==='rejected'||e.commandStatus==='expired')setRetryClose({account_login:Number(draft.account_login),position_ticket:item.position_ticket});},value=>{setRetryClose(null);setResult({account_login:value.account_login,position_ticket:item.position_ticket,closed:true,close_client_order_id:value.client_order_id});setCloseID('');setNotice('The original close is confirmed. No new close was submitted.');});
 };
 const retryRejectedClose=async()=>{if(!retryClose)return;await run(()=>closeManagerDemoPosition(retryClose.position_ticket,{account_login:retryClose.account_login,volume:0}),closeError,value=>{setRetryClose(null);setResult({account_login:value.account_login,position_ticket:retryClose.position_ticket,closed:true,close_client_order_id:value.client_order_id});setCloseID('');setNotice('Position close confirmed.');});};
 const ready=canPreview&&demoPreviewCurrent(preview,now)&&!pending.length&&!pendingCloses.length&&!result;
 return <section className="lp-demo-market" aria-label="Demo market order">
  <h2>Demo market order</h2>
  <p>Preview the saved route, then submit one market order on an authorized demo account. Final acceptance also checks available funds and current prices.</p>
  {!canPreview&&<p>Demo trading permission is required for a new preview. Original command recovery remains available.</p>}
  <form onSubmit={inspect}>
   <fieldset disabled={busy||Boolean(result)}><legend>Order</legend><div className="lp-demo-fields">
    <label>Demo account login<input inputMode="numeric" required value={draft.account_login} onChange={e=>update('account_login',e.target.value)}/></label>
    <label>Symbol<input required value={draft.symbol} onChange={e=>update('symbol',e.target.value)}/></label>
    <label>Side<select value={draft.side} onChange={e=>update('side',e.target.value)}><option value="buy">Buy</option><option value="sell">Sell</option></select></label>
    <label>Customer volume<input inputMode="decimal" required value={draft.volume} onChange={e=>update('volume',e.target.value)}/></label>
    <label>Execution policy<select value={draft.execution_policy} onChange={e=>update('execution_policy',e.target.value)}><option value="IOC">IOC</option><option value="FOK">FOK</option></select></label>
   </div><button type="submit" disabled={!canPreview||pending.length>0||pendingCloses.length>0||Boolean(result)}>Preview demo order</button></fieldset>
  </form>
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}{busy&&<p role="status">Waiting for the confirmed result…</p>}
  {pending.length>0&&<div><h3>Unresolved original orders</h3>{pending.map(item=><div key={item.client_order_id}><span>{item.client_order_id} · {item.symbol} · {item.side} · {item.volume}</span><button disabled={busy} onClick={()=>recover(item.client_order_id)}>Check original order</button></div>)}</div>}
  {pendingCloses.length>0&&<div><h3>Unresolved original closes</h3>{pendingCloses.map(item=><div key={item.client_order_id}><span>{item.client_order_id} - Position {item.position_ticket}</span><button disabled={busy} onClick={()=>recoverClose(item)}>Check original close</button></div>)}</div>}
  {retryClose&&!pendingCloses.length&&<div><p>The original close was rejected or expired. A new close requires an explicit retry and current authorization.</p><button disabled={busy} onClick={retryRejectedClose}>Retry position close</button></div>}
  {preview?.ready&&<div>{preview.exact_demo_sizing&&<><p>Operator-selected exact demo size; provider quantity grid unverified.</p><dl>{[['Authorization',preview.exact_demo_sizing.id],['Exact wire quantity',preview.exact_demo_sizing.wire_quantity],['Selected units per lot',preview.exact_demo_sizing.units_per_lot],['Opening authorization expires',preview.exact_demo_sizing.opening_valid_until]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></>}<dl>{[['Account',preview.draft.account_login],['Group',preview.scope.group_id],['Connection',preview.scope.connection_id],['Customer lots',preview.coverage.customer_lots],['LP requested lots',preview.coverage.lp_requested_lots],['Internal lots',preview.coverage.internal_lots],['Broker excess lots',preview.coverage.broker_excess_lots],['Valid until',preview.valid_until]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
   {!demoPreviewCurrent(preview,now)&&<p>Preview expired. Refresh it before submitting.</p>}<button disabled={busy||!ready} onClick={submit}>Submit demo order</button></div>}
  {result&&<div><h3>{result.closed?'Closed demo position':'Filled demo order'}</h3><dl>{[['Order command',result.client_order_id],['Position',result.position_ticket],['Close command',result.close_client_order_id]].filter(([,value])=>value!==undefined).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
   {!result.closed&&result.position_ticket&&<button disabled={busy} onClick={close}>{closeID?'Check original close':'Close this demo position'}</button>}
   {result.closed&&<button disabled={busy} onClick={()=>{setResult(null);setPreview(null);setNotice('');}}>Prepare another demo</button>}
  </div>}
 </section>;
}
