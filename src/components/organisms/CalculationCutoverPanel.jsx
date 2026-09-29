import {useEffect,useRef,useState} from 'react';
import {previewCalculationCutover,applyCalculationCutover,calculationCutoverStatus} from '../../services/calculationBaselineApi.js';
import {baselineLogin} from '../../services/calculationBaseline.js';
import {CUTOVER_TEMPLATE,parseCutoverDraft,readCutoverPreview,readCutoverPending,saveCutoverPending,readCutoverStatus,clearCutoverPending,withCutoverWriteLock} from '../../services/calculationCutover.js';
import {getManagerTradeScope} from '../../services/managerTradeApi.js';
import './calculation-baseline.css';

const OTHER_REASONS={unassigned_not_in_scope:'Has no calculation assignment and is not in this cutover',group_gains_symbols_account_not_moved:'Group gains symbols, but this account stays on its current version'};

// Separate cutover under the active calculation policy: adds definitions for
// new accounts, groups or symbols and moves only the reviewed accounts.
export default function CalculationCutoverPanel({sessionKey}) {
 const [login,setLogin]=useState(''),[text,setText]=useState(''),[review,setReview]=useState(null);
 const [pending,setPending]=useState(null),[ack,setAck]=useState(false),[busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 const generation=useRef(0),inFlight=useRef(false);
 useEffect(()=>{
  ++generation.current;inFlight.current=false;setBusy(false);setReview(null);setAck(false);setError('');setNotice('');setText('');
  const scope=getManagerTradeScope();
  const discover=()=>{
   if(scope!==getManagerTradeScope())return;
   try {const saved=readCutoverPending(globalThis.localStorage,scope);setPending(saved);if(saved){setLogin(saved.account_login);setReview(null);setAck(false);}}
   catch(e){setPending(null);setReview(null);setAck(false);setError(e.message);}
  };
  setLogin('');discover();
  const storageChanged=event=>{if(event.storageArea===globalThis.localStorage||event.storageArea===null)discover();};
  window.addEventListener('storage',storageChanged);window.addEventListener('focus',discover);
  return()=>{++generation.current;window.removeEventListener('storage',storageChanged);window.removeEventListener('focus',discover);};
 },[sessionKey]);
 const invalidate=()=>{setReview(null);setAck(false);setError('');setNotice('');};
 const run=async operation=>{
  if(inFlight.current)return;
  inFlight.current=true;setBusy(true);setError('');setNotice('');
  const token=++generation.current,scope=getManagerTradeScope();
  const current=()=>token===generation.current&&scope===getManagerTradeScope();
  try {await operation(current,scope);} catch(e){if(current())setError(e.message||'The request could not be completed.');}
  finally {if(current()){
   inFlight.current=false;setBusy(false);
   try {const saved=readCutoverPending(globalThis.localStorage,scope);setPending(saved);if(saved){setLogin(saved.account_login);setReview(null);setAck(false);}}
   catch(e){setReview(null);setAck(false);setError(e.message);}
  }}
 };
 const inspect=event=>{
  event.preventDefault();setReview(null);setAck(false);
  run(async current=>{
   const account=baselineLogin(login),cutover=parseCutoverDraft(text);
   const value=readCutoverPreview(await previewCalculationCutover(account,cutover));
   if(current())setReview({account,cutover,value});
  });
 };
 const finish=(scope,record,value,current)=>{
  const state=readCutoverStatus(value,record);
  if(!current())return;
  if(state.status==='active'){
   clearCutoverPending(globalThis.localStorage,scope,record,state);
   setPending(null);setReview(null);setAck(false);
   setNotice('The cutover is active for the reviewed accounts. Other accounts keep their existing calculation version.');
  }else setNotice(state.status==='absent'?'The original cutover has not been observed. Keep its identity and check again; a delayed request may still arrive.':state.status==='pending'?'The original cutover is still unresolved. Check its status again.':'A different or inactive release holds this cutover identity. Review the calculation policy before continuing.');
 };
 const apply=()=>{
  if(!review?.value.ready||!ack||pending)return;
  run(async(current,scope)=>withCutoverWriteLock(globalThis.navigator?.locks,scope,async()=>{
   if(!current())return;
   const record=saveCutoverPending(globalThis.localStorage,scope,review.account,review.value);
   if(current())setPending(record);
   const release=await applyCalculationCutover(review.account,review.cutover,record.fingerprint);
   finish(scope,record,{status:'active',fingerprint:record.fingerprint,release},current);
  }));
 };
 const recover=()=>{if(pending)run(async(current,scope)=>finish(scope,pending,await calculationCutoverStatus(pending.account_login,pending.fingerprint),current));};
 const loadFile=async event=>{
  const file=event.target.files?.[0];if(!file)return;
  invalidate();
  if(file.size>65536){setError('The reviewed cutover file must be at most 64 KB.');return;}
  await run(async current=>{const value=await file.text();parseCutoverDraft(value);if(current())setText(value);});
 };
 const v=review?.value;
 return <section className="calculation-baseline" aria-label="Calculation cutover for new accounts and symbols">
  <h2>Add accounts, groups or symbols to the active calculation policy</h2>
  <p>Use this after the initial baseline is active. It adds calculation definitions for new accounts, groups or symbols without changing any existing definition, balance, assignment or journal.</p>
  <p>Only the accounts listed in the review move to the new version. They must have no open positions, pending orders or in-flight orders. Every other account keeps its current version.</p>
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  {pending?<div><p>Original cutover awaiting confirmation: <code>{pending.fingerprint}</code></p><p>Broker {pending.broker_id}, parent version <code>{pending.parent_policy_version_id}</code>. Checking status does not submit the cutover again.</p><button disabled={busy} onClick={recover}>Check original cutover</button></div>:
   <form onSubmit={inspect}><fieldset disabled={busy}><legend>Reviewed cutover</legend>
    <label>Account login in this broker<input inputMode="numeric" required value={login} onChange={e=>{setLogin(e.target.value);invalidate();}}/></label>
    <label>Import reviewed cutover file<input type="file" accept=".json,application/json" onChange={loadFile}/></label>
    <details open={Boolean(text)}><summary>Edit cutover</summary>
     <p>List new accounts with their full calculation settings, new group and symbol definitions, and existing accounts to move. Existing definitions cannot be changed here.</p>
     <button type="button" disabled={Boolean(text.trim())} onClick={()=>{setText(CUTOVER_TEMPLATE);invalidate();}}>Start from template</button>
     <label>Cutover JSON<textarea rows="12" spellCheck="false" value={text} onChange={e=>{setText(e.target.value);invalidate();}}/></label>
    </details>
    <button type="submit" disabled={!text.trim()||!login.trim()}>Review cutover</button>
   </fieldset></form>}
  {v&&<div>
   <p>Broker: {v.broker_id}. Reason: {v.reason}</p>
   {v.parent_policy_version_id&&<p>Builds on active version <code>{v.parent_policy_version_id}</code> (lifecycle revision {v.parent_event_sequence}); lineage <code>{v.root_policy_version_id}</code>.</p>}
   {v.blockers.length>0&&<><h3>Blocked</h3><ul>{v.blockers.map((blocker,index)=><li key={index}>{blocker}</li>)}</ul></>}
   <table><caption>Accounts in this cutover</caption><thead><tr>{['Login','Group','Change','Revision','Opening balance','Opening credit','Opening revision','Open positions','Pending orders','In-flight orders','LP uses','Symbols gained'].map(label=><th key={label}>{label}</th>)}</tr></thead>
    <tbody>{v.accounts.map(row=><tr key={row.account_id}>{[row.account_login,row.group,row.cutover_kind==='NEW_ACCOUNT'?'New account':'Moved account',row.account_revision,row.checkpoint_balance,row.checkpoint_credit,row.checkpoint_source_revision,row.open_positions,row.pending_orders,row.unresolved_commands,row.in_flight_lp_uses,row.gained_symbols.join(', ')||'None'].map((value,index)=><td key={index}>{value}</td>)}</tr>)}</tbody></table>
   {v.accounts.filter(row=>row.proposed_calculation_settings).map(row=><details key={row.account_id}><summary>New account settings for {row.account_login}</summary>
    <p>Current hidden opening markup points: <code>{row.current_hidden_opening_markup_points}</code></p>
    <pre>{JSON.stringify(row.proposed_calculation_settings,null,2)}</pre></details>)}
   <table><caption>Definitions added</caption><thead><tr>{['Type','Group','Symbol or account','Definition hash'].map(label=><th key={label}>{label}</th>)}</tr></thead>
    <tbody>{v.added_definitions.map(row=><tr key={row.key}><td>{row.kind}</td><td>{row.group_name}</td><td>{row.kind==='symbol'?row.symbol:row.account_login}</td><td><code>{row.hash}</code></td></tr>)}</tbody></table>
   {v.settings_review.map((row,index)=><details key={index}><summary>New symbol {row.group_name} / {row.symbol}</summary>
    <h4>Current instrument</h4><pre>{row.current_instrument_json}</pre>
    <h4>Current group</h4><pre>{row.current_group_json}</pre>
    <h4>Current symbol overrides</h4><pre>{row.current_symbol_override_json}</pre>
    <h4>Proposed calculation settings</h4><pre>{JSON.stringify(row.proposed,null,2)}</pre>
   </details>)}
   {v.other_accounts.length>0&&<details><summary>Accounts not in this cutover ({v.other_accounts.length})</summary><ul>{v.other_accounts.map(row=><li key={row.account_login}>{row.account_login} / {row.group}: {OTHER_REASONS[row.reason]||row.reason}</li>)}</ul></details>}
   {v.ready&&<><p>Plan reference: <code>{v.fingerprint}</code></p>
    <label className="baseline-confirm"><input type="checkbox" disabled={busy||Boolean(pending)} checked={ack} onChange={e=>setAck(e.target.checked)}/>I reviewed the added definitions, the opening values of each listed account, and that only these accounts move to the new version.</label>
    <button disabled={busy||Boolean(pending)||!ack} onClick={apply}>Apply reviewed cutover</button></>}
  </div>}
  {busy&&<p role="status">Waiting for the current result...</p>}
 </section>;
}
