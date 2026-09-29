import LPGroupFeedControls from './LPGroupFeedControls.jsx';
import React, { useEffect, useRef, useState } from 'react';
import { lpFeeds, matchingFeedSnapshot } from '../../services/lpFeeds.js';
import './lp-feeds.css';
import { useAuthStore } from '../../store/authStore.js';
const adminPermissions={account:()=>true,connection:()=>true,group:()=>true};
export default function LPFeedsPanel({compact=false}){const session=useAuthStore(state=>state.accessToken);return session?<FeedWorkspace key={session} compact={compact} permissions={adminPermissions}/>:null;}

function FeedWorkspace({compact=false,permissions}){
 const [feeds,setFeeds]=useState([]),[source,setSource]=useState(''),[snapshot,setSnapshot]=useState(null),[error,setError]=useState(''),[refresh,setRefresh]=useState(0);
 const [account,setAccount]=useState(''),[loaded,setLoaded]=useState(null),[target,setTarget]=useState(''),[accountError,setAccountError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const [mode,setMode]=useState('override');
 const accountGeneration=useRef(0);
 useEffect(()=>()=>{accountGeneration.current++;},[]);
 useEffect(()=>{let disposed=false;setError('');lpFeeds.list().then(value=>{if(!disposed)setFeeds(value.feeds||[]);}).catch(e=>{if(!disposed){setFeeds([]);setSnapshot(null);setError(e.message);}});return()=>{disposed=true;};},[refresh]);
 useEffect(()=>{
  let disposed=false,timer;setSnapshot(null);setError('');
  if(!source)return()=>{};
  const poll=async()=>{try{
   const listing=await lpFeeds.list();if(disposed)return;setFeeds(listing.feeds||[]);
   const selected=listing.feeds?.find(feed=>feed.source_id===source);
   if(!selected?.connected)throw new Error('This source is disconnected or unavailable. No substitute source is shown.');
   const [catalog,ticks]=await Promise.all([lpFeeds.catalog(source),lpFeeds.ticks(source)]);
   const next=matchingFeedSnapshot(source,catalog,ticks);if(next.revision!==selected.connection_revision)throw new Error('Source revision changed. Waiting for current observations.');
   if(!disposed){setSnapshot(next);setError('');}
  }catch(e){if(!disposed){setSnapshot(null);setError(e.message);}}finally{if(!disposed)timer=setTimeout(poll,2000);}};
  poll();return()=>{disposed=true;clearTimeout(timer);};
 },[source,refresh]);
 const perform=async(save)=>{
  const request=++accountGeneration.current;setBusy(true);setAccountError('');setNotice('');
  try{const result=save?(mode==='inherit'?await lpFeeds.inheritAccount(loaded.account_id,loaded.account_revision||'0'):await lpFeeds.saveAccount(loaded.account_id,loaded.account_revision||'0',target)):await lpFeeds.account(account.trim());
   if(request===accountGeneration.current){setLoaded(result);setMode(result.mode||'override');setTarget(result.selection?.connection_id||'');setNotice(save?'Account source saved. Existing accepted orders keep their recorded source.':'');}
  }catch(e){if(request===accountGeneration.current){setAccountError(e.message);if(!save)setLoaded(null);}}
  finally{if(request===accountGeneration.current)setBusy(false);}
 };
 const canSave=loaded&&permissions.account('configuration',loaded.account_id,loaded.group_name)&&(mode==='inherit'||permissions.connection('configuration',target))&&(!loaded.selection||permissions.connection('configuration',loaded.selection.connection_id));
 return <section className="lp-feeds-panel" aria-label="Named quote feeds">
  <header><span>Named quote feeds</span><button onClick={()=>setRefresh(value=>value+1)}>Refresh sources</button></header>
  <p>Inspect one explicit source. Exact FIX decimal prices are preserved as received; displayed quotes are observations, not execution-price evidence.</p>
  <label>Inspect source<select aria-label="Inspect source" value={source} onChange={event=>{setSnapshot(null);setSource(event.target.value);}}>
   <option value="">Choose a source</option>{source&&!feeds.some(feed=>feed.source_id===source)&&<option value={source}>{source} — unavailable</option>}
   {feeds.map(feed=><option key={feed.source_id} value={feed.source_id}>{feed.name} ({feed.source_id}) — {feed.connected?'connected':'disconnected'}</option>)}
  </select></label>
  {error&&<p role="alert">{error}</p>}
  {snapshot&&<><p>Source {source} · connection revision {snapshot.revision} · published {new Date(snapshot.publishedAt).toISOString()}</p>
  <div className="lp-feed-table"><table><thead><tr><th>Symbol</th><th>Provider instrument</th><th>Bid</th><th>Ask</th><th>Observation age</th></tr></thead><tbody>
  {snapshot.catalog.map(item=>{const tick=snapshot.ticks[item.symbol];return <tr key={item.symbol}><td>{item.symbol}</td><td>{item.provider_instrument_id}</td><td>{tick?.bid||'—'}</td><td>{tick?.ask||'—'}</td><td>{tick?Math.max(0,Math.floor((Date.now()-tick.received_at_ms)/1000))+'s':'No observation'}</td></tr>;})}
  </tbody></table></div></>}
  {!compact&&<fieldset><legend>Account quote source</legend>
   <p>Choose an explicit account override or inherit the saved group default. No source is substituted when the group default is absent. Positions, pending orders and unresolved execution block changes.</p>
   <label>Account UUID<input aria-label="Account UUID" value={account} onChange={event=>{accountGeneration.current++;setBusy(false);setLoaded(null);setNotice('');setAccountError('');setAccount(event.target.value);}}/></label>
   <button disabled={busy||!account.trim()} onClick={()=>perform(false)}>Load account source</button>
   {loaded&&<><p>Account {loaded.account_id} · group {loaded.group_name} · account override revision {loaded.account_revision||'0'}</p>
    <p>Saved source: {loaded.selection?.connection_id||'None'}{loaded.selection?' · connection revision '+loaded.selection.connection_revision:''}</p>
    <p>Effective source: {loaded.selection?.source_kind||'None'} {loaded.selection?.source_group||''} - source revision {loaded.selection?.source_revision||'0'}</p><label>Selection mode<select aria-label="Account source mode" value={mode} disabled={busy} onChange={e=>setMode(e.target.value)}><option value="override">Explicit account override</option><option value="inherit">Inherit group default</option></select></label>
    <label>Account source<select aria-label="Account source" value={target} disabled={busy||mode==='inherit'} onChange={event=>setTarget(event.target.value)}><option value="">Choose a source</option>
    {target&&!feeds.some(feed=>feed.source_id===target)&&<option value={target}>{target} — unavailable</option>}
    {feeds.map(feed=><option key={feed.source_id} value={feed.source_id}>{feed.name} ({feed.source_id})</option>)}</select></label>
    <button disabled={busy||!canSave||(mode==='override'&&!feeds.some(feed=>feed.source_id===target))} onClick={()=>perform(true)}>Save account source</button>
    {!canSave&&<p>Configuration permission for this account, group and both source connections is required.</p>}
   </>}
   {accountError&&<p role="alert">{accountError}</p>}{notice&&<p role="status">{notice}</p>}
  </fieldset>}
  {!compact&&<LPGroupFeedControls feeds={feeds} permissions={permissions}/>}
 </section>;
}
