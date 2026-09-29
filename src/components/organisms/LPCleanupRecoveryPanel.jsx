import {useCallback,useEffect,useRef,useState} from 'react';
import {CLEANUP_RECOVERY_NOTE_MAX,cleanupRecoveryActionLabel,cleanupRecoveryForbiddenLabel,cleanupRecoveryReasonText,lpCleanupRecovery} from '../../services/lpCleanupRecovery.js';
import './lp-cleanup-recovery.css';

// D01 recovery panel inside the LP journal detail. Read-only unless the server
// reports mutations_enabled and actor_can_act. An accepted request is only
// "requested": outcomes appear in the journal detail after refresh, sending
// only when the sender records an attempt, and closure only from the position
// lifecycle stage. This panel never reports an outcome from its own request.
const noteBytes=value=>new TextEncoder().encode(value).length;
const requestedText=(action,round)=>round?'Recovery round '+round.round+' requested and recorded as accepted, not completed. Budget: up to '+round.max_attempts+' attempts after attempt '+round.attempt_offset+', deadline '+round.deadline+', remaining at authorization '+round.remaining+' (wire). Nothing is sending until the sender records an attempt in the cleanup attempts above.':cleanupRecoveryActionLabel[action]+': requested, not completed. The audited outcome appears in the journal detail after refresh.';

export default function LPCleanupRecoveryPanel({intentID,service=lpCleanupRecovery}){
 const [record,setRecord]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[locked,setLocked]=useState(false),[confirming,setConfirming]=useState(null),[note,setNote]=useState(''),[requested,setRequested]=useState({});
 const generation=useRef(0);
 const load=useCallback(async()=>{const token=++generation.current;setBusy(true);setError('');setLocked(false);setConfirming(null);setNote('');try{const value=await service.get(intentID);if(token===generation.current)setRecord(value);}catch(e){if(token===generation.current){setRecord(null);setError(e.message);setLocked(true);}}finally{if(token===generation.current)setBusy(false);}},[intentID,service]);
 useEffect(()=>{const tokens=generation;load();return()=>{tokens.current++;};},[load]);
 const canAct=Boolean(record&&record.mutations_enabled&&record.actor_can_act);
 async function submit(event){
  event.preventDefault();
  if(!record||!confirming||!canAct||locked)return;
  const option=record.options.find(o=>o.action===confirming);
  if(!option?.permitted)return;
  const token=++generation.current;setBusy(true);setError('');setNotice('');
  try{
   const accepted=await service.act(intentID,{action:confirming,expected_plan_revision:record.plan_revision,note});
   if(token!==generation.current)return;
   setRequested(old=>({...old,[accepted.action]:{round:accepted.round||null}}));
   setNotice(requestedText(accepted.action,accepted.round));
   setConfirming(null);setNote('');setRecord(null);
   const value=await service.get(intentID);
   if(token===generation.current)setRecord(value);
  }catch(e){if(token===generation.current){setError(e.message);setLocked(true);setConfirming(null);if(e.code==='FORBIDDEN')setRecord(null);}}
  finally{if(token===generation.current)setBusy(false);}
 }
 const bytes=noteBytes(note);
 return <section className="lp-cleanup-recovery" aria-label="Cleanup recovery">
  <h3>Cleanup recovery</h3>
  <p>Audited recovery requests for a stopped cleanup plan. A request is not reconciliation, not a send and not a close. This panel cannot force-close, edit remaining, waive costs or book customers.</p>
  <button type="button" disabled={busy} onClick={load}>Reload recovery options</button>
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}{busy&&<p role="status">Loading cleanup recovery…</p>}
  {locked&&<p>Reload recovery options before another request.</p>}
  {record&&<>
   <dl>{[['Plan',record.plan_id],['Plan revision',record.plan_revision],['Cleanup state',record.status],['Escalation',record.escalation||'None recorded'],['Recorded remaining (wire)',record.remaining],['Attributable (wire)',record.attributable],['Attempts',String(record.attempts)],['Unreconciled attempts',String(record.unreconciled_attempts)],['Recovery rounds used / max',record.rounds_authorized+' / '+record.max_rounds]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
   {record.status==='held'&&<p>Evidence resolution required; recovery rounds are not available.</p>}
   {!record.mutations_enabled&&<p>Recovery actions are disabled on this server. Options are shown for review only.</p>}
   {record.mutations_enabled&&!record.actor_can_act&&<p>Inspection only. The {record.required_permission} permission is required to request recovery actions.</p>}
   <fieldset disabled={busy||locked||!canAct}><legend>Recovery options</legend>
    <ul>{record.options.map(option=><li key={option.action}>
     <strong>{cleanupRecoveryActionLabel[option.action]}</strong> <code>{option.action}</code>
     <div>Reason: <code>{option.reason}</code> - {cleanupRecoveryReasonText(option.reason)}</div>
     {requested[option.action]&&<div>Requested in this view; not completed.</div>}
     {canAct&&option.permitted&&<button type="button" aria-label={'Request '+option.action} onClick={()=>{setConfirming(option.action);setNote('');setNotice('');}}>{option.mutating?'Review round authorization':'Review request'}</button>}
    </li>)}</ul>
   </fieldset>
   {canAct&&confirming&&<form role="dialog" aria-label="Confirm cleanup recovery action" onSubmit={submit}>
    <p>Action: <strong>{cleanupRecoveryActionLabel[confirming]}</strong> (<code>{confirming}</code>)</p>
    <p>Expected plan revision: <code>{record.plan_revision}</code>. The server refuses the request if the plan changed.</p>
    {confirming==='authorize_recovery_round'&&<p>A round only permits the ordinary cleanup sender to resume within the pinned limits. It does not send, close or book anything by itself.</p>}
    <label>Note (required, up to {CLEANUP_RECOVERY_NOTE_MAX} bytes)<textarea required aria-label="Recovery note" maxLength={CLEANUP_RECOVERY_NOTE_MAX} value={note} onChange={e=>setNote(e.target.value)}/></label>
    <p>{bytes} / {CLEANUP_RECOVERY_NOTE_MAX} bytes</p>
    <button type="submit" disabled={busy||locked||!note.trim()||bytes>CLEANUP_RECOVERY_NOTE_MAX}>Send recovery request</button>
    <button type="button" disabled={busy} onClick={()=>{setConfirming(null);setNote('');}}>Cancel</button>
   </form>}
   <h4>Never offered</h4>
   <p>These actions are forbidden whatever the plan state:</p>
   <ul>{record.forbidden_actions.map(action=><li key={action}>{cleanupRecoveryForbiddenLabel[action]||action}</li>)}</ul>
  </>}
 </section>;
}
