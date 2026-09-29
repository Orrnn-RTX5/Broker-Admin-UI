import {useEffect,useRef,useState} from 'react';
import {emptyNativePendingDraft,lpNativePendingEnablement} from '../../services/lpNativePendingEnablement.js';
import {useAuthStore} from '../../store/authStore.js';
import './lp-native-pending-enablement.css';

export const NATIVE_PENDING_EXPLANATION='Offers A-book native pending orders (limit/stop placed at the LP) for one saved connection and instrument. Default off. Applies to new placements only; working native orders, cancellation and recovery are unchanged. Also requires the protected deployment flag and current evidence. A later change to the native pending capability or connection revision turns this off until an Admin re-enables it.';

// Admin session only (Manager proxy refuses non-Admin sessions).
export default function LPNativePendingEnablementPanel({api=lpNativePendingEnablement}){
 const session=useAuthStore(s=>s.accessToken);
 return session?<NativePendingWorkspace key={session} api={api}/>:null;
}

const flags=[['allow_limit','Limit'],['allow_stop','Stop'],['allow_gtc','GTC'],['allow_gtd','GTD']];

function NativePendingWorkspace({api}){
 const [instruments,setInstruments]=useState([]),[target,setTarget]=useState(''),[record,setRecord]=useState(null),[draft,setDraft]=useState(emptyNativePendingDraft),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[locked,setLocked]=useState(false);
 const generation=useRef(0);
 const selected=instruments.find(i=>`${i.connection}\u0000${i.symbol}`===target);
 const reset=()=>{generation.current++;setRecord(null);setDraft(emptyNativePendingDraft());setConfirmed(false);setError('');setNotice('');setLocked(false);setBusy(false);};
 async function refresh(){reset();setTarget('');const token=++generation.current;setBusy(true);try{const rows=await api.instruments();if(token===generation.current)setInstruments(rows);}catch(e){if(token===generation.current){setInstruments([]);setError(e.message);}}finally{if(token===generation.current)setBusy(false);}}
 useEffect(()=>{refresh();return()=>{generation.current++;};},[]); // eslint-disable-line react-hooks/exhaustive-deps -- load once per Admin session.
 const apply=value=>{setRecord(value);const s=value.status.saved;setDraft(s?{enabled:s.enabled,allow_limit:s.allow_limit,allow_stop:s.allow_stop,allow_gtc:s.allow_gtc,allow_gtd:s.allow_gtd,reason:''}:emptyNativePendingDraft());setConfirmed(false);};
 async function load(){if(!selected)return;const token=++generation.current;setBusy(true);setError('');setNotice('');setRecord(null);setLocked(false);try{const value=await api.get(selected.connection,selected.symbol);if(token===generation.current)apply(value);}catch(e){if(token===generation.current)setError(e.message);}finally{if(token===generation.current)setBusy(false);}}
 async function save(event){
  event.preventDefault();if(!record||!selected||locked||(draft.enabled&&!confirmed))return;
  const token=++generation.current;setBusy(true);setError('');setNotice('');
  try{const value=await api.save(selected.connection,selected.symbol,record.status.saved?.revision??'0',record.status.current_evidence_revision,draft);if(token===generation.current){apply(value);const s=value.status.saved;setNotice(`Saved revision ${s.revision}: ${s.enabled?'enabled':'disabled'}${s.enabled?` for evidence revision ${s.evidence_revision}`:''}. ${value.status.effective?'Effective for new placements when the deployment flag is on.':'Not effective.'}`);}}
  catch(e){if(token===generation.current){setError(e.message);setLocked(true);if(['FORBIDDEN','LP_FORBIDDEN'].includes(e.code)){setRecord(null);setInstruments([]);}}}
  finally{if(token===generation.current)setBusy(false);}
 }
 const s=record?.status;const saved=s?.saved;
 return <section className="lp-native-pending-enablement" aria-label="A-book native pending enablement">
  <header><h2>A-book native pending enablement</h2><p>{NATIVE_PENDING_EXPLANATION}</p></header>
  <label>Instrument evidence<select aria-label="Native pending instrument" value={target} disabled={busy} onChange={e=>{reset();setTarget(e.target.value);}}><option value="">Select saved evidence</option>{instruments.map(i=><option key={`${i.connection}/${i.symbol}`} value={`${i.connection}\u0000${i.symbol}`}>{i.connection} / {i.symbol} (evidence r{i.revision}{i.exactDemo?', exact demo sizing':''}{i.nativePending?'':', no native pending evidence'}{i.nativeCancel?'':', no cancel evidence'})</option>)}</select></label>
  <button type="button" disabled={busy||!selected} onClick={load}>Load enablement</button><button type="button" disabled={busy} onClick={refresh}>Refresh evidence list</button>
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}{busy&&<p role="status">Loading native pending enablement...</p>}
  {record&&<form onSubmit={save}>
   <p>{saved?`Saved revision ${saved.revision}: ${saved.enabled?'enabled':'disabled'} by login ${saved.actor_login} (${saved.reason}).`:'No saved revision: disabled by default.'} Current evidence revision {s.current_evidence_revision}. {saved?.enabled?(s.binding_current?'Bound to the current capability.':'Stale: the capability or connection changed since enabling; placement is off until re-enabled.'):''} Cancellation evidence {s.cancel_evidence_current?'current':'missing or expired'}. Effective: {s.effective?'yes':'no'}.</p>
   <fieldset disabled={busy||locked}><legend>New revision</legend>
    <label>Offer native pending<input aria-label="Enable native pending" type="checkbox" checked={draft.enabled} onChange={e=>{const on=e.target.checked;setConfirmed(false);setDraft(old=>on?{...old,enabled:true}:{...emptyNativePendingDraft(),reason:old.reason});}}/></label>
    {flags.map(([key,label])=><label key={key}>{label}<input aria-label={`Allow ${label}`} type="checkbox" disabled={!draft.enabled} checked={draft[key]} onChange={e=>setDraft(old=>({...old,[key]:e.target.checked}))}/></label>)}
    <label>Reason (8-256 characters)<input aria-label="Enablement reason" required minLength={8} maxLength={256} value={draft.reason} onChange={e=>setDraft(old=>({...old,reason:e.target.value}))}/></label>
    {draft.enabled&&<label>I reviewed evidence revision {s.current_evidence_revision} and the live acceptance abort rules<input aria-label="Confirm reviewed evidence" type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/></label>}
    <button type="submit" disabled={draft.enabled&&!confirmed}>{draft.enabled?'Save enablement':'Save disablement'}</button>
   </fieldset>
   {locked&&<p>Reload the enablement before another save.</p>}
  </form>}
 </section>;
}
