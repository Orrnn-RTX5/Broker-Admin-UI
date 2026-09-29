import {useEffect,useRef,useState} from 'react';
import {lpExactPendingModifyAdmission,MODIFY_ADMISSION_MIN,MODIFY_ADMISSION_MAX,MODIFY_ADMISSION_DEFAULT} from '../../services/lpExactPendingModifyAdmission.js';
import {useAuthStore} from '../../store/authStore.js';
import './lp-exact-pending-modify.css';

export const MODIFY_ADMISSION_EXPLANATION='Counts unsuccessful Modify requests per pending ticket (rejected, expired or still in flight). At the limit the customer must cancel and place a new order. Applies to new Modify requests only; replay of an admitted request is never limited.';

// Exact pending Modify admission limit (lane A4). Admin session only.
export default function LPExactPendingModifyAdmissionPanel({api=lpExactPendingModifyAdmission}){
 const session=useAuthStore(s=>s.accessToken);
 return session?<ModifyAdmissionWorkspace key={session} api={api}/>:null;
}

function ModifyAdmissionWorkspace({api}){
 const [record,setRecord]=useState(null),[draft,setDraft]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[locked,setLocked]=useState(false);
 const generation=useRef(0);
 const apply=value=>{setRecord(value);setDraft(String(value.max_unsuccessful_modify_per_ticket));};
 async function load(){
  const token=++generation.current;setBusy(true);setError('');setNotice('');setLocked(false);
  try{const value=await api.get();if(token===generation.current)apply(value);}
  catch(e){if(token===generation.current){setRecord(null);setDraft('');setError(e.message);}}
  finally{if(token===generation.current)setBusy(false);}
 }
 useEffect(()=>{load();return()=>{generation.current++;};},[]); // eslint-disable-line react-hooks/exhaustive-deps -- load once per Admin session.
 async function save(event){
  event.preventDefault();if(!record||locked)return;
  const token=++generation.current;setBusy(true);setError('');setNotice('');
  try{const value=await api.save(record.revision,draft);if(token===generation.current){apply(value);setNotice(`Saved limit ${value.max_unsuccessful_modify_per_ticket} at revision ${value.revision}. Applies to new Modify requests only.`);}}
  catch(e){if(token===generation.current){setError(e.message);setLocked(true);if(['FORBIDDEN','LP_FORBIDDEN'].includes(e.code)){setRecord(null);setDraft('');}}}
  finally{if(token===generation.current)setBusy(false);}
 }
 return <section className="lp-exact-pending-modify" aria-label="Exact pending Modify admission">
  <header><h2>Exact pending Modify admission limit</h2><p>{MODIFY_ADMISSION_EXPLANATION}</p></header>
  <button type="button" disabled={busy} onClick={load}>Reload admission limit</button>
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}{busy&&<p role="status">Loading Modify admission limit...</p>}
  {record&&<form onSubmit={save}>
   <p>{record.configured?`Current limit ${record.max_unsuccessful_modify_per_ticket} (saved revision ${record.revision}).`:`Default ${MODIFY_ADMISSION_DEFAULT} (no saved revision).`}</p>
   <fieldset disabled={busy||locked}><legend>Unsuccessful Modify requests per pending ticket</legend>
    <label>Limit ({MODIFY_ADMISSION_MIN}-{MODIFY_ADMISSION_MAX})<input aria-label="Unsuccessful Modify limit" type="number" inputMode="numeric" required min={MODIFY_ADMISSION_MIN} max={MODIFY_ADMISSION_MAX} step={1} value={draft} onChange={e=>setDraft(e.target.value)}/></label>
    <button type="submit">Save admission limit</button>
   </fieldset>
   {locked&&<p>Reload the admission limit before another save.</p>}
  </form>}
 </section>;
}
