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
  <header><h3>Source continuity</h3><p>Named trigger quote-source gaps and business held by them. Held items are not evaluated until an operator releases them.</p></header>
  {error&&<p role="alert">{error}</p>}
  {!error&&!value&&<p role="status">Loading source continuity...</p>}
  {value&&!value.typed&&<p role="status">{value.message}</p>}
  {value&&value.typed&&!value.available&&<p role="alert">{value.message}</p>}
  {value?.typed&&value.available&&<>
   <p className="lp-source-gaps-status"><strong className={value.degraded?'is-degraded':'is-normal'}>{value.degraded?'Degraded':'Normal'}</strong>{' · '}Policy: pending orders — Hold until operator release; protections — Hold until operator release.{' '}Observed {new Date(value.observed_at).toLocaleString()}.</p>
   <p>Open gaps: {value.unresumed_gaps}. Symbols awaiting first fresh quote: {value.open_symbol_gaps}. Held items: {value.held_business}. Recorded gaps: {value.recorded_gaps}.{awaitingFirstFresh>0&&` ${awaitingFirstFresh} held item${awaitingFirstFresh===1?' is':'s are'} resumed but awaiting a first fresh quote.`}</p>
   {filterable?<label>Holds shown<select aria-label="Holds shown" value={effectiveScope} onChange={e=>setScope(e.target.value)}><option value="connection">Selected connection ({connectionID})</option><option value="all">All feeds</option></select></label>:<p>Connection filter unavailable; showing holds for all feeds.</p>}
   <p>{shown.length} of {holds.length} held item{holds.length===1?'':'s'} shown.</p>
   {notice&&<p role="status">{notice}</p>}
   {shown.length>0&&<div className="lp-source-gaps-table"><table><thead><tr><th>Item</th><th>Ticket</th><th>Version</th><th>Account</th><th>Symbol</th><th>Reason</th><th>Opened</th><th>Resumed</th><th>First fresh quote</th><th>Release</th></tr></thead><tbody>{shown.map(hold=>{
    const key=holdKey(hold),state=releaseState(hold),done=released.has(key);
    return <tr key={key}><td>{kindLabel[hold.entity_kind]}</td><td>{hold.ticket_text}</td><td>{hold.order_version}</td><td>{hold.account_login}</td><td>{hold.symbol}</td><td>{SOURCE_GAP_REASONS[hold.gap_reason]}{hold.gap_ids.length>1&&` (${hold.gap_ids.length} gaps)`}</td><td>{new Date(hold.opened_at).toLocaleString()}</td><td>{hold.resumed?'Yes':'No'}</td><td>{hold.first_fresh_seen?'Seen':'Not yet'}</td>
     <td>{done?<span role="status">Release recorded; awaiting status refresh</span>:state.allowed?<button type="button" disabled={busy} onClick={()=>openConfirm(hold)}>Release hold</button>:<><button type="button" disabled title={state.reason}>Release hold</button><span className="lp-source-gaps-reason">{state.reason}</span></>}</td></tr>;
   })}</tbody></table></div>}
   {confirming&&<form className="lp-source-gaps-confirm" role="dialog" aria-label="Confirm hold release" onSubmit={release}>
    <p>Release {kindLabel[confirming.entity_kind]} {confirming.ticket_text} version {confirming.order_version} ({confirming.symbol}).</p>
    <p><strong>{RELEASE_CONFIRM_TEXT}</strong></p>
    <label>Operator reference (8-256 characters)<input aria-label="Operator reference" required minLength={8} maxLength={256} value={reference} disabled={busy} onChange={e=>setReference(e.target.value)}/></label>
    {releaseError&&<p role="alert">{releaseError}</p>}
    <button type="submit" disabled={busy||reference.trim().length<8}>Confirm release</button><button type="button" disabled={busy} onClick={()=>{setConfirming(null);setReleaseError('');}}>Cancel</button>
    {busy&&<span role="status">Releasing...</span>}
   </form>}
  </>}
 </section>;
}
