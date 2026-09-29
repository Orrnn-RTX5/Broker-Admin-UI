import LPGroupFeedControls from './LPGroupFeedControls.jsx';
import React, { useEffect, useRef, useState } from 'react';
import { lpFeeds, matchingFeedSnapshot } from '../../services/lpFeeds.js';
import './lp-feeds.css';
import { useAuthStore } from '../../store/authStore.js';
const adminPermissions={account:()=>true,connection:()=>true,group:()=>true};
const DISCONNECTED='This LP is not connected, so no prices are shown. No substitute source is shown.';
// Market Watch remembers the LP the broker last picked (per browser only).
const SOURCE_KEY='rtx5.admin.lpQuoteSource';
const rememberedSource=()=>{try{return localStorage.getItem(SOURCE_KEY)||'';}catch{return '';}};
const rememberSource=value=>{try{if(value)localStorage.setItem(SOURCE_KEY,value);else localStorage.removeItem(SOURCE_KEY);}catch{/* storage unavailable */}};
const ageText=ms=>{const s=Math.max(0,Math.floor((Date.now()-ms)/1000));return s<60?s+'s':Math.floor(s/60)+'m';};
export default function LPFeedsPanel({compact=false}){const session=useAuthStore(state=>state.accessToken);return session?<FeedWorkspace key={session} compact={compact} permissions={adminPermissions}/>:null;}

function FeedWorkspace({compact=false,permissions}){
 const [feeds,setFeeds]=useState([]),[source,setSource]=useState(()=>compact?rememberedSource():''),[snapshot,setSnapshot]=useState(null),[error,setError]=useState(''),[listError,setListError]=useState(''),[listLoading,setListLoading]=useState(true),[refresh,setRefresh]=useState(0),[filter,setFilter]=useState('');
 const [account,setAccount]=useState(''),[loaded,setLoaded]=useState(null),[target,setTarget]=useState(''),[accountError,setAccountError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const [mode,setMode]=useState('override');
 const accountGeneration=useRef(0);
 useEffect(()=>()=>{accountGeneration.current++;},[]);
 useEffect(()=>{let disposed=false;setListLoading(true);setListError('');lpFeeds.list().then(value=>{if(!disposed)setFeeds(value.feeds||[]);}).catch(e=>{if(!disposed){setFeeds([]);setListError(e.message);}}).finally(()=>{if(!disposed)setListLoading(false);});return()=>{disposed=true;};},[refresh]);
 useEffect(()=>{
  let disposed=false,timer;setSnapshot(null);setError('');
  if(!source)return()=>{};
  const poll=async()=>{try{
   const listing=await lpFeeds.list();if(disposed)return;setFeeds(listing.feeds||[]);setListError('');
   const selected=listing.feeds?.find(feed=>feed.source_id===source);
   if(!selected?.connected)throw new Error(DISCONNECTED);
   const [catalog,ticks]=await Promise.all([lpFeeds.catalog(source),lpFeeds.ticks(source)]);
   const next=matchingFeedSnapshot(source,catalog,ticks);if(next.revision!==selected.connection_revision)throw new Error('LP settings changed. Waiting for fresh prices.');
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
 const choose=value=>{setSnapshot(null);setFilter('');setSource(value);if(compact)rememberSource(value);};
 // With a single LP there is nothing to choose, so Market Watch shows it directly.
 useEffect(()=>{if(compact&&!source&&feeds.length===1)choose(feeds[0].source_id);},[compact,source,feeds]); // eslint-disable-line react-hooks/exhaustive-deps -- choose only sets state.
 const selected=feeds.find(feed=>feed.source_id===source);
 const state=!source?'idle':error?'down':snapshot?'live':'loading';
 const query=filter.trim().toUpperCase();
 const rows=snapshot?snapshot.catalog.filter(item=>!query||item.symbol.toUpperCase().includes(query)):[];
 return <section className={'lp-feeds-panel'+(compact?' is-compact':'')} aria-label="Named quote feeds">
  <header><span className="lp-feeds-title">LP quotes</span><button type="button" disabled={listLoading} onClick={()=>setRefresh(value=>value+1)}>{listLoading?'Refreshing…':'Refresh sources'}</button></header>
  <p className="lp-feeds-intro">Pick an LP to see the prices it is sending right now. Prices are shown exactly as received and are never mixed with another LP.{!compact&&' Displayed quotes are observations, not execution-price evidence.'}</p>
  <label>Quote source<select aria-label="Inspect source" value={source} onChange={event=>choose(event.target.value)}>
   <option value="">Choose an LP</option>{source&&!selected&&<option value={source}>{source} — unavailable</option>}
   {feeds.map(feed=><option key={feed.source_id} value={feed.source_id} title={feed.source_id}>{feed.name} — {feed.connected?'Connected':'Not connected'}</option>)}
  </select></label>
  {listLoading&&!feeds.length&&<p className="lp-feeds-note" role="status">Loading LP connections…</p>}
  {!listLoading&&!feeds.length&&!listError&&<p className="lp-feeds-note">No LP connections yet. Add one under Gateways → Connections.</p>}
  {listError&&!source&&<div className="lp-feed-problem" role="alert"><p>Could not load LP connections: {listError}</p><p>Use Refresh sources to try again.</p></div>}
  {source&&<p className={'lp-feed-status is-'+state}><span className="lp-feed-dot" aria-hidden="true"/>{state==='live'?`Live · ${snapshot.catalog.length} symbol${snapshot.catalog.length===1?'':'s'} · updated ${ageText(snapshot.publishedAt)} ago`:state==='down'?'Prices unavailable':'Loading prices…'}</p>}
  {source&&error&&<div className="lp-feed-problem" role="alert"><p>{error}</p>{selected&&!selected.connected&&<p className="lp-feeds-note">To connect it: Gateways → Connections → select this LP → Test saved connection.</p>}</div>}
  {snapshot&&<>
  {!compact&&<p className="lp-feeds-note">Source {source} · connection revision {snapshot.revision} · published {new Date(snapshot.publishedAt).toISOString()}</p>}
  {snapshot.catalog.length>8&&<input className="lp-feed-filter" aria-label="Filter LP symbols" placeholder="Search symbols…" value={filter} onChange={event=>setFilter(event.target.value)}/>}
  <div className="lp-feed-table" role="region" aria-label="Quotes for selected LP" tabIndex={0}><table><thead><tr><th scope="col">Symbol</th>{!compact&&<th scope="col">Provider instrument</th>}<th scope="col" className="num">Bid</th><th scope="col" className="num">Ask</th><th scope="col" className="num">{compact?'Age':'Observation age'}</th></tr></thead><tbody>
  {rows.map(item=>{const tick=snapshot.ticks[item.symbol];return <tr key={item.symbol}><th scope="row">{item.symbol}</th>{!compact&&<td>{item.provider_instrument_id}</td>}<td className="num">{tick?.bid||'—'}</td><td className="num">{tick?.ask||'—'}</td><td className="num">{tick?ageText(tick.received_at_ms):compact?'—':'No observation'}</td></tr>;})}
  {!rows.length&&<tr><td colSpan={compact?4:5}>{query?'No symbols match.':'This LP has not sent any symbols yet.'}</td></tr>}
  </tbody></table></div></>}
  {!compact&&<fieldset><legend>Account quote source</legend>
   <p>Choose an explicit account override or inherit the saved group default. No source is substituted when the group default is absent. Positions, pending orders and unresolved execution block changes.</p>
   <label>Account UUID<input aria-label="Account UUID" value={account} onChange={event=>{accountGeneration.current++;setBusy(false);setLoaded(null);setNotice('');setAccountError('');setAccount(event.target.value);}}/></label>
   <button type="button" disabled={busy||!account.trim()} onClick={()=>perform(false)}>{busy&&!loaded?'Loading account…':'Load account source'}</button>
   {loaded&&<><p>Account {loaded.account_id} · group {loaded.group_name} · account override revision {loaded.account_revision||'0'}</p>
    <p>Saved source: {loaded.selection?.connection_id||'None'}{loaded.selection?' · connection revision '+loaded.selection.connection_revision:''}</p>
    <p>Effective source: {loaded.selection?.source_kind||'None'} {loaded.selection?.source_group||''} - source revision {loaded.selection?.source_revision||'0'}</p><label>Selection mode<select aria-label="Account source mode" value={mode} disabled={busy} onChange={e=>setMode(e.target.value)}><option value="override">Explicit account override</option><option value="inherit">Inherit group default</option></select></label>
    <label>Account source<select aria-label="Account source" value={target} disabled={busy||mode==='inherit'} onChange={event=>setTarget(event.target.value)}><option value="">Choose a source</option>
    {target&&!feeds.some(feed=>feed.source_id===target)&&<option value={target}>{target} — unavailable</option>}
    {feeds.map(feed=><option key={feed.source_id} value={feed.source_id}>{feed.name} ({feed.source_id})</option>)}</select></label>
    <button type="button" disabled={busy||!canSave||(mode==='override'&&!feeds.some(feed=>feed.source_id===target))} onClick={()=>perform(true)}>{busy?'Saving…':'Save account source'}</button>
    {!canSave&&<p>Configuration permission for this account, group and both source connections is required.</p>}
   </>}
   {accountError&&<p role="alert">{accountError}</p>}{notice&&<p role="status">{notice}</p>}
  </fieldset>}
  {!compact&&<LPGroupFeedControls feeds={feeds} permissions={permissions}/>}
 </section>;
}
