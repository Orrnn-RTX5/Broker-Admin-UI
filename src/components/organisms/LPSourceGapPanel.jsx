import {useEffect,useRef,useState} from 'react';
import {lpSourceGaps,holdKey,releaseState,namedFeedID,SOURCE_GAP_REASONS,RELEASE_CONFIRM_TEXT} from '../../services/lpSourceGaps.js';
import {useAuthStore} from '../../store/authStore.js';
import './lp-source-gaps.css';

const POLL_MS=5000;
const MAX_FEED_REVISIONS=256;
const hidden=()=>typeof document!=='undefined'&&document.visibilityState==='hidden';
const kindLabel={pending:'Pending order',protection:'Position protection'};

// Source continuity (lane A3): typed source-gap status and operator release of
// held business. The policy is `hold` and is shown, never edited.
export default function LPSourceGapPanel({connectionID,revision,api=lpSourceGaps}){
 const session=useAuthStore(s=>s.accessToken);
 return session?<SourceGapWorkspace key={session} connectionID={connectionID} revision={revision} api={api}/>:null;
}

function SourceGapWorkspace({connectionID,revision,api}){
 const [value,setValue]=useState(null),[error,setError]=useState(''),[feeds,setFeeds]=useState(null),[scope,setScope]=useState('connection');
 const [confirming,setConfirming]=useState(null),[reference,setReference]=useState(''),[busy,setBusy]=useState(false),[releaseError,setReleaseError]=useState(''),[notice,setNotice]=useState(''),[released,setReleased]=useState(()=>new Set());
 const generation=useRef(0);
 async function poll(){
  const token=++generation.current;
  try{const next=await api.status();if(token!==generation.current)return;setValue(next);setError('');const live=new Set(next.holds.map(holdKey));setReleased(old=>{const kept=[...old].filter(key=>live.has(key));return kept.length===old.size?old:new Set(kept);});}
  catch(e){if(token===generation.current){setValue(null);setError(e.message||'Source continuity status is unavailable.');}}
 }
 useEffect(()=>{
  poll();
  const timer=setInterval(()=>{if(!hidden())poll();},POLL_MS);
  const onVisible=()=>{if(!hidden())poll();};
  document.addEventListener('visibilitychange',onVisible);
  // Invalidate any status request that resolves after this workspace is removed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return()=>{generation.current++;clearInterval(timer);document.removeEventListener('visibilitychange',onVisible);};
 },[api]); // eslint-disable-line react-hooks/exhaustive-deps -- poll reads the latest api prop.
 const tenant=value?.tenant_id;
 useEffect(()=>{
  let current=true;setFeeds(null);
  if(!tenant||!connectionID||!Number.isSafeInteger(revision)||revision<1)return undefined;
  const first=Math.max(1,revision-MAX_FEED_REVISIONS+1);
  Promise.all(Array.from({length:revision-first+1},(_,i)=>namedFeedID(tenant,connectionID,first+i))).then(ids=>{if(current){const set=new Set(ids.filter(Boolean));setFeeds(set.size?set:null);}}).catch(()=>{if(current)setFeeds(null);});
  return()=>{current=false;};
 },[tenant,connectionID,revision]);

 const holds=value?.holds||[];
 const matches=hold=>(hold.connection_id!=null&&hold.connection_id===connectionID)||(feeds?.has(hold.feed)??false);
 const filterable=Boolean(feeds)||holds.some(hold=>hold.connection_id!=null);
 const effectiveScope=filterable?scope:'all';
 const shown=effectiveScope==='connection'?holds.filter(matches):holds;
 const awaitingFirstFresh=holds.filter(hold=>hold.resumed&&!hold.first_fresh_seen).length;

 function openConfirm(hold){setConfirming(hold);setReference('');setReleaseError('');setNotice('');}
 async function release(event){
  event.preventDefault();if(!confirming||busy)return;
  const target=confirming;setBusy(true);setReleaseError('');
  try{const result=await api.release({...target,reference});setReleased(old=>new Set(old).add(holdKey(target)));setConfirming(null);setReference('');setNotice(`Release recorded for ${kindLabel[target.entity_kind]} ${target.ticket_text} (${result.released} hold${result.released===1?'':'s'}). The row clears when the next status no longer lists it.`);}
  catch(e){setReleaseError(e.message+(e.code?` (${e.code})`:''));}
  finally{setBusy(false);}
 }

 return <section className="lp-source-gaps" aria-label="Source continuity">
  <header className="lp-source-gaps-head"><h3>Source continuity</h3><p>Track gaps in a named LP quote source and any pending orders or position protections they hold. Held items remain paused until an operator releases them.</p></header>
  {error&&<p role="alert">{error}</p>}
  {!error&&!value&&<p role="status">Loading source continuity...</p>}
  {value&&!value.typed&&<p role="status">{value.message}</p>}
  {value&&value.typed&&!value.available&&<p role="alert">{value.message}</p>}
  {value?.typed&&value.available&&<>
   <p className="lp-source-gaps-status"><strong className={value.degraded?'is-degraded':'is-normal'}>{value.degraded?'Degraded':'Normal'}</strong><span>Pending orders and protections: Hold until operator release.</span><span>Last observed {new Date(value.observed_at).toLocaleString()}.</span></p>
   <dl className="lp-source-gaps-counts"><div><dt>Open gaps</dt><dd>{value.unresumed_gaps}</dd></div><div><dt>Symbols awaiting a fresh quote</dt><dd>{value.open_symbol_gaps}</dd></div><div><dt>Held items</dt><dd>{value.held_business}</dd></div><div><dt>Recorded gaps</dt><dd>{value.recorded_gaps}</dd></div></dl>
   {awaitingFirstFresh>0&&<p className="lp-source-gaps-note">{awaitingFirstFresh} held item{awaitingFirstFresh===1?' is':'s are'} resumed but awaiting a first fresh quote.</p>}
   {filterable?<label className="lp-source-gaps-filter">Holds shown<select aria-label="Holds shown" value={effectiveScope} onChange={e=>setScope(e.target.value)}><option value="connection">Selected connection ({connectionID})</option><option value="all">All feeds</option></select></label>:<p>Connection filter unavailable; showing holds for all feeds.</p>}
   <p className="lp-source-gaps-shown">{shown.length} of {holds.length} held item{holds.length===1?'':'s'} shown.</p>
   {notice&&<p role="status">{notice}</p>}
   {!shown.length&&<p className="lp-source-gaps-empty">{holds.length?'No held items match the selected connection. Choose All feeds to see the remaining holds.':'No held items are currently reported.'}</p>}
   {shown.length>0&&<div className="lp-source-gaps-table" role="region" aria-label="Held items" tabIndex={0}><table><thead><tr><th scope="col">Item</th><th scope="col">Ticket</th><th scope="col">Version</th><th scope="col">Account</th><th scope="col">Symbol</th><th scope="col">Reason</th><th scope="col">Opened</th><th scope="col">Gap resumed</th><th scope="col">First fresh quote</th><th scope="col">Release</th></tr></thead><tbody>{shown.map(hold=>{
    const key=holdKey(hold),state=releaseState(hold),done=released.has(key);
    return <tr key={key}><th scope="row">{kindLabel[hold.entity_kind]}</th><td>{hold.ticket_text}</td><td>{hold.order_version}</td><td>{hold.account_login}</td><td>{hold.symbol}</td><td>{SOURCE_GAP_REASONS[hold.gap_reason]}{hold.gap_ids.length>1&&` (${hold.gap_ids.length} gaps)`}</td><td>{new Date(hold.opened_at).toLocaleString()}</td><td className={hold.resumed?'is-yes':'is-no'}>{hold.resumed?'Yes':'No'}</td><td className={hold.first_fresh_seen?'is-yes':'is-no'}>{hold.first_fresh_seen?'Seen':'Not yet'}</td>
     <td>{done?<span role="status">Release recorded; awaiting status refresh</span>:state.allowed?<button type="button" disabled={busy} onClick={()=>openConfirm(hold)}>Release hold</button>:<><button type="button" disabled title={state.reason}>Release hold</button><span className="lp-source-gaps-reason">{state.reason}</span></>}</td></tr>;
   })}</tbody></table></div>}
   {confirming&&<form className="lp-source-gaps-confirm" role="dialog" aria-label="Confirm hold release" onSubmit={release}>
    <p>Release {kindLabel[confirming.entity_kind]} {confirming.ticket_text} version {confirming.order_version} ({confirming.symbol}).</p>
    <p><strong>{RELEASE_CONFIRM_TEXT}</strong></p>
    <label>Operator reference (8-256 characters)<input aria-label="Operator reference" autoFocus required minLength={8} maxLength={256} value={reference} disabled={busy} onChange={e=>setReference(e.target.value)}/></label>
    {releaseError&&<p role="alert">{releaseError}</p>}
    <button type="submit" disabled={busy||reference.trim().length<8}>Confirm release</button><button type="button" disabled={busy} onClick={()=>{setConfirming(null);setReleaseError('');}}>Cancel</button>
    {busy&&<span role="status">Releasing...</span>}
   </form>}
  </>}
 </section>;
}
