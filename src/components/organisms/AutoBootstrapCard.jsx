import {useEffect,useRef,useState} from 'react';
import {getAutoBootstrap,getAutoBootstrapStatus,putAutoBootstrap,runAutoBootstrap} from '../../services/autoBootstrapApi.js';
import {buildAutoBootstrapPut,describeAutoBootstrapRun,readAutoBootstrapConfig,readAutoBootstrapRun,readAutoBootstrapStatus} from '../../services/autoBootstrap.js';
import {baselineLogin} from '../../services/calculationBaseline.js';
import './calculation-baseline.css';

const ACTIVE_POLL_MS=3000,IDLE_POLL_MS=30000;
const formFrom=config=>({enabled:config.enabled,execution:config.attestation.execution,risk:config.attestation.risk,fx:config.attestation.fx});
function Findings({title,items,className}){
 return <div className={className}><h3>{title} ({items.length})</h3><ul>{items.map((item,index)=><li key={index}><code>{item.code}</code>{item.subject&&<> · <strong>{item.subject}</strong></>}: {item.message}</li>)}</ul></div>;
}
export default function AutoBootstrapCard({sessionKey}){
 const [login,setLogin]=useState(''),[loadedLogin,setLoadedLogin]=useState(''),[loadToken,setLoadToken]=useState(0);
 const [config,setConfig]=useState(null),[form,setForm]=useState(null),[status,setStatus]=useState(null);
 const [runStarted,setRunStarted]=useState(false),[busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 const generation=useRef(0),inFlight=useRef(false);
 // A run is "in progress" from the server status or from the request just sent.
 const running=status?.running===true||runStarted;
 useEffect(()=>{
  ++generation.current;inFlight.current=false;setBusy(false);setLogin('');setLoadedLogin('');setConfig(null);setForm(null);setStatus(null);setRunStarted(false);setError('');setNotice('');
 },[sessionKey]);
 // Every request runs through act: one at a time, and its result is dropped if the login or session changed meanwhile.
 const act=async operation=>{
  if(inFlight.current)return;
  inFlight.current=true;setBusy(true);setError('');setNotice('');
  const token=++generation.current,current=()=>token===generation.current;
  try {await operation(current);}
  catch(e){if(current())setError(e.message||'The request could not be completed.');}
  finally {if(current()){inFlight.current=false;setBusy(false);}}
 };
 const changeLogin=event=>{
  ++generation.current;inFlight.current=false;setBusy(false);
  setLogin(event.target.value);setLoadedLogin('');setConfig(null);setForm(null);setStatus(null);setRunStarted(false);setError('');setNotice('');
 };
 const setField=key=>event=>{const value=event.target.value;setForm(current=>({...current,[key]:value}));};
 const setEnabled=event=>{const value=event.target.checked;setForm(current=>({...current,enabled:value}));};
 // Status is polled every 3 s while a run is in progress, otherwise every 30 s.
 // The effect restarts on each load, on each change of running, so a new run is seen at once.
 useEffect(()=>{
  if(!loadedLogin)return undefined;
  let stopped=false,timer=0;
  const poll=async()=>{
   try {const value=readAutoBootstrapStatus(await getAutoBootstrapStatus(loadedLogin));if(!stopped)setStatus(value);}
   catch(e){if(!stopped)setError(e.message||'The automatic bootstrap status could not be read.');}
   if(!stopped)timer=setTimeout(poll,running?ACTIVE_POLL_MS:IDLE_POLL_MS);
  };
  poll();
  return()=>{stopped=true;clearTimeout(timer);};
 },[loadedLogin,loadToken,running]);
 const load=()=>act(async current=>{
  const target=baselineLogin(login);
  const value=readAutoBootstrapConfig(await getAutoBootstrap(target));
  if(!current())return;
  setConfig(value);setForm(formFrom(value));setLoadedLogin(target);setLoadToken(token=>token+1);
  setNotice(`Automatic bootstrap settings loaded for account ${target}.`);
 });
 const save=event=>{
  event.preventDefault();
  if(!config||!form||!loadedLogin)return;
  act(async current=>{
   await putAutoBootstrap(loadedLogin,buildAutoBootstrapPut(config,form));
   const value=readAutoBootstrapConfig(await getAutoBootstrap(loadedLogin));
   if(!current())return;
   setConfig(value);setForm(formFrom(value));setNotice('Automatic bootstrap settings saved.');
  });
 };
 // The run uses the saved settings, so a disabled config asks first.
 const runNow=()=>{
  if(!loadedLogin||busy||running)return;
  if(config&&!config.enabled&&typeof globalThis.confirm==='function'&&!globalThis.confirm('Automatic bootstrap is disabled. Running it now can still activate the baseline if every check passes. Run it now?'))return;
  act(async current=>{
   setRunStarted(true);
   try {
    const run=readAutoBootstrapRun((await runAutoBootstrap(loadedLogin))?.run);
    if(!current())return;
    setStatus(value=>value?{...value,lastRun:run,running:false}:value);
    setNotice(describeAutoBootstrapRun(run));
   } finally {if(current())setRunStarted(false);}
  });
 };
 const lastRun=status?.lastRun??null;
 return <section className="calculation-baseline auto-bootstrap" aria-label="Automatic baseline bootstrap">
  <h2>Automatic baseline bootstrap</h2>
  <p>Activates the reviewed baseline for this broker automatically once every check passes. While any blocker remains, nothing is activated and the blockers are listed below.</p>
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  <label>Account login in this broker<input inputMode="numeric" value={login} onChange={changeLogin}/></label>
  <button type="button" disabled={busy||!login.trim()} onClick={load}>Load automatic bootstrap</button>
  {config&&form&&<><form onSubmit={save}><fieldset disabled={busy}><legend>Settings for account {loadedLogin}</legend>
   {!config.configured&&<p>No automatic bootstrap settings are saved for this broker yet.</p>}
   <label className="baseline-confirm"><input type="checkbox" checked={form.enabled} onChange={setEnabled}/>Enable automatic bootstrap</label>
   <label>Execution policy attestation (required when enabled)<textarea rows="2" value={form.execution} onChange={setField('execution')}/></label>
   <label>Risk policy attestation (required when enabled)<textarea rows="2" value={form.risk} onChange={setField('risk')}/></label>
   <label>FX conversion policy attestation (required when enabled)<textarea rows="2" value={form.fx} onChange={setField('fx')}/></label>
   <button type="submit" disabled={busy}>Save automatic bootstrap settings</button>
  </fieldset></form>
  <div>
   <p>Saved: {config.enabled?'enabled':'disabled'}{config.updated_at&&<> · updated {config.updated_at} by {config.updated_by}</>}</p>
   <p>Bootstrap now runs with the saved settings, even when automatic bootstrap is disabled.</p>
   <button type="button" disabled={busy||running} onClick={runNow}>Bootstrap now</button>
  </div></>}
  {status&&<div aria-label="Automatic bootstrap status">
   {status.running&&<p role="status">A bootstrap run is in progress.</p>}
   <p>Lineage: <code>{status.lineage}</code></p>
   {status.nextAttemptAt&&<p>Next attempt: {status.nextAttemptAt}</p>}
   {status.healthReason&&<p>Health: <code>{status.healthReason}</code></p>}
   {lastRun&&<div>
    <p>Last run: {describeAutoBootstrapRun(lastRun)}</p>
    {Object.keys(lastRun.steps).length>0&&<p>Steps: {Object.entries(lastRun.steps).map(([key,state])=>`${key} ${state}`).join(' · ')}</p>}
    {lastRun.draftHash&&<p>Draft: <code>{lastRun.draftHash}</code></p>}
    {lastRun.blockers.length>0&&<div className="baseline-blockers"><Findings title="Blockers" items={lastRun.blockers}/></div>}
    {lastRun.warnings.length>0&&<div className="baseline-warnings"><Findings title="Warnings" items={lastRun.warnings}/></div>}
   </div>}
  </div>}
 </section>;
}
