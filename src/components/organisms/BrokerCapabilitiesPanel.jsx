import {useEffect,useRef,useState} from 'react';
import {brokerCapabilities,CAPABILITY_REASON_MIN,CAPABILITY_REASON_MAX} from '../../services/brokerCapabilities.js';
import {useAuthStore} from '../../store/authStore.js';
import './broker-capabilities.css';

// Broker capability registry (R15/R17 G4/G5/G14). Broker Admin only. Every
// state and reason is computed by the server and rendered verbatim; the panel
// only records a desired state with the loaded revision. Deployment-gated
// features are read-only: no toggle is ever offered for them.
export default function BrokerCapabilitiesPanel({api=brokerCapabilities}){
 const session=useAuthStore(s=>s.accessToken);
 return session?<CapabilitiesWorkspace key={session} api={api}/>:null;
}

const yesNo=v=>v?'yes':'no';

function Reasons({items,label}){
 if(!items.length)return null;
 return <ul aria-label={label}>{items.map((r,i)=><li key={`${r.code}-${r.subject||''}-${i}`}><code>{r.code}</code>{r.subject?<> <code>{r.subject}</code></>:null}: {r.required_step}</li>)}</ul>;
}

function CapabilityRow({item,busy,locked,onChange}){
 const [reason,setReason]=useState('');
 const next=!item.desired_enabled;
 const blocked=item.change_blockers.length>0;
 return <article className="broker-capability" aria-label={`Capability ${item.key}`}>
  <header><h3>{item.title}</h3><p><code>{item.key}</code> | owner {item.owner} | master switch <code>{item.compiled_constant}</code></p></header>
  <dl>
   <dt>Effective</dt><dd data-state={item.effective?'on':'off'}>{item.effective?'ON':'OFF'}</dd>
   <dt>Desired</dt><dd>{item.desired_enabled?'on':'off'} (revision {item.revision})</dd>
   <dt>Prerequisites met</dt><dd>{yesNo(item.prerequisites_met)}</dd>
   <dt>Compiled in</dt><dd>{yesNo(item.compiled_in)}</dd>
   {item.last_actor_login&&<><dt>Last change</dt><dd>Admin {item.last_actor_login} at {item.last_changed_at}: {item.last_reason}</dd></>}
   {item.receipt_id&&<><dt>Verification receipt</dt><dd><code>{item.receipt_id}</code></dd></>}
  </dl>
  <Reasons items={item.reasons} label={`Why ${item.key} is not effective`}/>
  <Reasons items={item.change_blockers} label={`Why ${item.key} cannot change now`}/>
  <form onSubmit={e=>{e.preventDefault();onChange(item,next,reason);}}>
   <fieldset disabled={busy||locked||blocked}><legend>Record desired state {next?'on':'off'}</legend>
    <label>Reason ({CAPABILITY_REASON_MIN}-{CAPABILITY_REASON_MAX} characters)<input aria-label={`Reason for ${item.key}`} required minLength={CAPABILITY_REASON_MIN} maxLength={CAPABILITY_REASON_MAX} value={reason} onChange={e=>setReason(e.target.value)}/></label>
    <button type="submit">{next?'Set desired on':'Set desired off'}</button>
   </fieldset>
   {next&&!item.compiled_in&&<p>Recording "on" does not enable anything in this build: effective stays OFF until a reviewed build sets <code>{item.compiled_constant}</code>.</p>}
  </form>
 </article>;
}

function CapabilitiesWorkspace({api}){
 const [view,setView]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[locked,setLocked]=useState(false);
 const generation=useRef(0);
 async function load(){
  const token=++generation.current;setBusy(true);setError('');setNotice('');setLocked(false);
  try{const value=await api.get();if(token===generation.current)setView(value);}
  catch(e){if(token===generation.current){setView(null);setError(e.message);}}
  finally{if(token===generation.current)setBusy(false);}
 }
 useEffect(()=>{load();return()=>{generation.current++;};},[]); // eslint-disable-line react-hooks/exhaustive-deps -- load once per Admin session.
 async function change(item,desired,reason){
  if(locked)return;
  const token=++generation.current;setBusy(true);setError('');setNotice('');
  try{const value=await api.change(item.key,item.revision,desired,reason);if(token===generation.current){setView(value);const saved=value.capabilities.find(c=>c.key===item.key);setNotice(`Recorded desired ${desired?'on':'off'} for ${item.key} at revision ${saved.revision}. Effective: ${saved.effective?'ON':'OFF'}.`);}}
  catch(e){if(token===generation.current){setError(e.message);setLocked(true);if(['FORBIDDEN','LP_FORBIDDEN','LP_PERMISSION_DENIED'].includes(e.code))setView(null);}}
  finally{if(token===generation.current)setBusy(false);}
 }
 return <section className="broker-capabilities" aria-label="Broker capabilities">
  <header><h2>Capabilities</h2><p>Effective = desired AND prerequisites AND compiled in. Prerequisites and reasons are computed by the server. Each change is an audited revision.</p></header>
  <button type="button" disabled={busy} onClick={load}>Reload capabilities</button>
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}{busy&&<p role="status">Loading capabilities...</p>}
  {locked&&<p>Reload the capabilities before another change.</p>}
  {view&&<>
   {!view.registry_ready&&<p role="alert">Registry storage (migration 338) is unavailable. Every capability is off and no change can be recorded.</p>}
   {view.capabilities.map(item=><CapabilityRow key={`${item.key}-${item.revision}`} item={item} busy={busy} locked={locked||!view.registry_ready} onChange={change}/>)}
   <h3>Deployment-gated features (read only)</h3>
   <p>These need a protected deployment step and a restart of their owning service. They cannot be switched here.</p>
   <table aria-label="Deployment-gated features"><thead><tr><th>Feature</th><th>Owner</th><th>Variable</th><th>State</th><th>Reason</th><th>Required step</th></tr></thead>
    <tbody>{view.environment.map(f=><tr key={`${f.owner}-${f.key}`} data-state={f.state}><td>{f.title}</td><td>{f.owner}</td><td><code>{f.env}</code></td><td>{f.state}</td><td><code>{f.reason_code}</code></td><td>{f.required_step}</td></tr>)}</tbody>
   </table>
  </>}
 </section>;
}
