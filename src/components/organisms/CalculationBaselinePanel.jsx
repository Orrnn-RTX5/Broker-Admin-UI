import {useEffect,useRef,useState} from 'react';
import {previewCalculationBaseline,activateCalculationBaseline,calculationBaselineStatus,calculationBaselineSources,generateCalculationBaseline} from '../../services/calculationBaselineApi.js';
import {BASELINE_DRAFT_LIMIT_BYTES,BASELINE_DRAFT_LIMIT_TEXT,buildBaselineGenerateRequest,readBaselineGenerate,readBaselineSources,baselineAccountMarginBoundary,baselineAccountPricing,baselineLogin,parseBaselineDraft,readBaselinePreview,readBaselinePending,saveBaselinePending,readBaselineStatus,clearBaselinePending,withBaselineWriteLock} from '../../services/calculationBaseline.js';
import {getManagerTradeScope} from '../../services/managerTradeApi.js';
import './calculation-baseline.css';

export default function CalculationBaselinePanel({sessionKey}) {
 const [login,setLogin]=useState(''),[text,setText]=useState(''),[review,setReview]=useState(null);
 const [pending,setPending]=useState(null),[ack,setAck]=useState(false),[busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 const [sources,setSources]=useState(null);
 // Generate draft from current settings: the request form and the last result.
 const emptyGenerate={symbolGroups:'',acceptGroupCommissions:false,zeroCommissionReason:'',execution:'',risk:'',fx:'',calculationPolicyId:''};
 const [generateForm,setGenerateForm]=useState(emptyGenerate),[generated,setGenerated]=useState(null);
 // Any change to the request or to the Policy JSON makes the shown result stale.
 // Enter in a generate field must not submit the surrounding review form.
 const keepEnter=event=>{if(event.key==='Enter')event.preventDefault();};
 const setGenerateField=key=>event=>{const value=event.target.type==='checkbox'?event.target.checked:event.target.value;setGenerateForm(form=>({...form,[key]:value}));setGenerated(null);};
 const generation=useRef(0),inFlight=useRef(false);
 useEffect(()=>{
  ++generation.current;inFlight.current=false;setBusy(false);setReview(null);setAck(false);setError('');setNotice('');setText('');setSources(null);setGenerated(null);
  const scope=getManagerTradeScope();
  const discover=()=>{
   if(scope!==getManagerTradeScope())return;
   try { const saved=readBaselinePending(globalThis.localStorage,scope);setPending(saved);if(saved){setLogin(saved.account_login);setReview(null);setAck(false);} }
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
   try {const saved=readBaselinePending(globalThis.localStorage,scope);setPending(saved);if(saved){setLogin(saved.account_login);setReview(null);setAck(false);}}
   catch(e){setReview(null);setAck(false);setError(e.message);}
  }}
 };
 const inspect=event=>{
  event.preventDefault();setReview(null);setAck(false);
  run(async current=>{
   const account=baselineLogin(login),draft=parseBaselineDraft(text);
   const value=readBaselinePreview(await previewCalculationBaseline(account,draft));
   if(current())setReview({account,draft,value});
  });
 };
 const generate=()=>{
  if(text.trim()&&typeof globalThis.confirm==='function'&&!globalThis.confirm('Replace the Policy JSON already entered with a newly generated draft?'))return;
  run(async current=>{
  setGenerated(null);
  const account=baselineLogin(login),request=buildBaselineGenerateRequest(generateForm);
  const value=readBaselineGenerate(await generateCalculationBaseline(account,request));
  if(!current())return;
  invalidate();setGenerated(value);
  if(value.text){setText(value.text);setNotice(`Draft filled into the Policy JSON (${new TextEncoder().encode(value.text).length} bytes). Review it, then select Review account baseline.`);}
  });
 };
 const loadSources=()=>run(async(current,scope)=>{
  setSources(null);
  const value=readBaselineSources(await calculationBaselineSources(baselineLogin(login)),scope);
  if(current())setSources(value);
 });
 const finish=(scope,record,value,current)=>{
  const state=readBaselineStatus(value,record);
  if(!current())return;
  if(state.status==='active'){
   clearBaselinePending(globalThis.localStorage,scope,record,state);
   setPending(null);setReview(null);setAck(false);
   setNotice('The reviewed accounting baseline is active. Inspect the broker accounts and journal before trading.');
  }else setNotice(state.status==='absent'?'The original activation has not been observed. Keep its identity and check again; a delayed request may still arrive.':state.status==='pending'?'The original activation is still unresolved. Check its status again.':'The current baseline differs from this activation. Review the broker policy before continuing.');
 };
 const activate=()=>{
  if(!review?.value.ready||!ack||pending)return;
  run(async(current,scope)=>withBaselineWriteLock(globalThis.navigator?.locks,scope,async()=>{
   if(!current())return;
   const record=saveBaselinePending(globalThis.localStorage,scope,review.account,review.value);
   if(current())setPending(record);
   const release=await activateCalculationBaseline(review.account,review.draft,record.fingerprint);
   finish(scope,record,{status:'active',fingerprint:record.fingerprint,release},current);
  }));
 };
 const recover=()=>{if(pending)run(async(current,scope)=>finish(scope,pending,await calculationBaselineStatus(pending.account_login,pending.fingerprint),current));};
 const loadFile=async event=>{
  const file=event.target.files?.[0];if(!file)return;
  invalidate();setGenerated(null);
  if(file.size>BASELINE_DRAFT_LIMIT_BYTES){setError(BASELINE_DRAFT_LIMIT_TEXT);return;}
  await run(async current=>{const value=await file.text();parseBaselineDraft(value);if(current())setText(value);});
 };
 return <section className="calculation-baseline" aria-label="Initial accounting baseline">
  <h2>Initial accounting baseline</h2>
  <p>Review the first calculation policy against every current broker account. Existing balances, credit and legacy history are preserved.</p>
  <p>Activation applies to the whole broker, including accounts outside the demo group. Unsupported legacy account creation and funding actions will be blocked after activation.</p>
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  {pending?<div><p>Original activation awaiting confirmation: <code>{pending.fingerprint}</code></p><p>Broker {pending.broker_id}, account {pending.account_login}. Checking status does not submit another activation.</p><button disabled={busy} onClick={recover}>Check original activation</button></div>:
   <form onSubmit={inspect}><fieldset disabled={busy}><legend>Reviewed policy</legend>
    <label>Account login in this broker<input inputMode="numeric" required value={login} onChange={e=>{setLogin(e.target.value);setSources(null);setGenerated(null);invalidate();}}/></label>
    <button type="button" disabled={!login.trim()} onClick={loadSources}>Read current broker settings</button>
    <details className="baseline-generate"><summary>Generate draft from current settings</summary>
     <p>Builds a complete policy from the broker's current accounts, groups, instruments and commissions. Nothing is saved; the draft fills the Policy JSON for review.</p>
     <label>Symbol groups (optional; one per line or comma separated; empty = all groups)<textarea rows="2" spellCheck="false" value={generateForm.symbolGroups} onChange={setGenerateField('symbolGroups')}/></label>
     <label className="baseline-confirm"><input type="checkbox" checked={generateForm.acceptGroupCommissions} onChange={setGenerateField('acceptGroupCommissions')}/>Carry each group's current per-lot commission into the policy</label>
     <label>Zero commission reason (optional)<input value={generateForm.zeroCommissionReason} onKeyDown={keepEnter} onChange={setGenerateField('zeroCommissionReason')}/></label>
     <label>Execution policy attestation (required)<textarea rows="2" value={generateForm.execution} onChange={setGenerateField('execution')}/></label>
     <label>Risk policy attestation (required)<textarea rows="2" value={generateForm.risk} onChange={setGenerateField('risk')}/></label>
     <label>FX conversion policy attestation (required)<textarea rows="2" value={generateForm.fx} onChange={setGenerateField('fx')}/></label>
     <label>Calculation policy ID (optional)<input value={generateForm.calculationPolicyId} onKeyDown={keepEnter} onChange={setGenerateField('calculationPolicyId')}/></label>
     <button type="button" disabled={!login.trim()||!generateForm.execution.trim()||!generateForm.risk.trim()||!generateForm.fx.trim()} onClick={generate}>Generate draft from current settings</button>
    </details>
    <label>Import reviewed policy file<input type="file" accept=".json,application/json" onChange={loadFile}/></label>
    <details><summary>Review imported policy</summary><label>Policy JSON<textarea rows="10" spellCheck="false" value={text} onChange={e=>{setText(e.target.value);setGenerated(null);invalidate();}}/></label></details>
    <button type="submit" disabled={!text.trim()}>Review account baseline</button>
   </fieldset></form>}
  {generated&&<div className="baseline-generated" aria-label="Generated draft">
   {generated.draftError&&<p role="alert">{generated.draftError}</p>}
   {!generated.text&&!generated.draftError&&<p role="alert">No draft could be built from the current settings. Resolve the blockers below and generate again.</p>}
   {Object.keys(generated.summary).length>0&&<p>Draft summary: {Object.entries(generated.summary).map(([key,value])=>`${key.replaceAll('_',' ')} ${value}`).join(' · ')}</p>}
   {generated.blockers.length>0&&<div className="baseline-blockers"><h3>Blockers ({generated.blockers.length}): activation is refused until each one is resolved</h3>
    <ul>{generated.blockers.map((item,index)=><li key={index}><code>{item.code}</code>{item.subject&&<> · <strong>{item.subject}</strong></>}: {item.message}</li>)}</ul></div>}
   {generated.warnings.length>0&&<div className="baseline-warnings"><h3>Warnings ({generated.warnings.length})</h3>
    <ul>{generated.warnings.map((item,index)=><li key={index}><code>{item.code}</code>{item.subject&&<> · <strong>{item.subject}</strong></>}: {item.message}</li>)}</ul></div>}
   {generated.text&&!generated.blockers.length&&<p role="status">No blockers. Review the Policy JSON, then select Review account baseline.</p>}
  </div>}
  {sources&&<div aria-label="Current broker settings">
   <p>Current settings for {sources.broker_id}, observed {sources.observed_at}. These values need a reviewed policy before they can be imported.</p>
   <p>Source reference: <code>{sources.source_snapshot_hash}</code></p>
   <ul>{sources.required_inputs.map(value=><li key={value}>{value}</li>)}</ul>
   {[['Accounts','accounts_json'],['Groups','groups_json'],['Enabled instruments','instruments_json'],['Symbol overrides','symbol_overrides_json'],['Hidden opening pricing','hidden_markups_json'],['Saved account feeds','account_feeds_json'],['Saved group feeds','group_feeds_json']].map(([label,key])=><details key={key}><summary>{label} ({sources[key].length})</summary>{sources[key].map((raw,index)=><pre key={index}>{raw}</pre>)}</details>)}
  </div>}
  {review&&<div><p>Broker: {review.value.broker_id}</p>
   <table><caption>Current account values</caption><thead><tr>{['Login','Group','Currency','Balance','Credit','Revision','Open positions','Pending orders','Unresolved commands'].map(label=><th key={label}>{label}</th>)}</tr></thead>
    <tbody>{review.value.accounts.map(row=><tr key={row.account_id}>{[row.account_login,row.group,row.currency,row.balance,row.credit,row.account_revision,row.open_positions,row.pending_orders,row.unresolved_commands].map((value,index)=><td key={index}>{value}</td>)}</tr>)}</tbody></table>
   {review.value.blockers.length>0&&<ul>{review.value.blockers.map((blocker,index)=><li key={index}>{blocker}</li>)}</ul>}
   <h3>Account-specific pricing and calculation settings</h3>
   {review.value.accounts.map(row=>{const pricing=baselineAccountPricing(row,review.value.ready);return <div key={row.account_id}>
    <h4>Account {row.account_login} / {row.group}</h4>
    <p>Current hidden opening markup points: <code>{pricing.current}</code></p>
    <p>Proposed hidden opening markup points: <code>{pricing.proposed ?? 'Unavailable ? review blocked'}</code></p>
    {row.proposed_calculation_settings&&<p>Proposed margin rounding: {baselineAccountMarginBoundary(row.proposed_calculation_settings)==='account_total'?'Sum exact margin across the account, then round once.':'Round each symbol first, then sum the account.'}</p>}
    {row.proposed_calculation_settings&&<details><summary>Proposed account settings for {row.account_login}</summary><pre>{JSON.stringify(row.proposed_calculation_settings,null,2)}</pre></details>}
   </div>;})}
   <h3>Current and proposed calculation settings</h3>
   <p>Existing cash values are preserved. Review these settings separately: the imported policy determines future profit, margin and commission calculations.</p>
   {review.value.settings_review.map((row,index)=><details key={index}><summary>{row.group_name} / {row.symbol}</summary>
    <h4>Current instrument</h4><pre>{row.current_instrument_json}</pre>
    <h4>Current group</h4><pre>{row.current_group_json}</pre>
    <h4>Current symbol overrides</h4><pre>{row.current_symbol_override_json}</pre>
    <p>Proposed symbol margin rounding: <code>{row.proposed.margin_rounding_boundary ?? 'Not supplied'}</code>. Hedge method: <code>{row.proposed.hedge_method ?? 'Not supplied'}</code>.</p>
    <h4>Proposed calculation settings</h4><pre>{JSON.stringify(row.proposed,null,2)}</pre>
   </details>)}
   <details><summary>Proposed commissions</summary><pre>{JSON.stringify(review.value.proposed_commissions,null,2)}</pre></details>
   <p>Policy reference: <code>{review.value.settings_export_hash}</code></p>
   {review.value.ready&&<><label className="baseline-confirm"><input type="checkbox" disabled={busy||Boolean(pending)} checked={ack} onChange={e=>setAck(e.target.checked)}/>I reviewed the current and proposed calculation settings, all broker accounts, and the effect on legacy account and funding actions.</label><button disabled={busy||Boolean(pending)||!ack} onClick={activate}>Approve and activate reviewed baseline</button></>}
  </div>}
  {busy&&<p role="status">Waiting for the current result...</p>}
 </section>;
}
