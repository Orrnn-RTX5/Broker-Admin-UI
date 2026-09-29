import {useEffect,useRef,useState} from 'react';
import {privateFixReadiness,PRIVATE_FIX_CODES} from '../../services/privateFixReadiness.js';
import {useAuthStore} from '../../store/authStore.js';
import './private-fix-readiness.css';

// B-book private FIX readiness (R15/R17 G6/G7). B-book is always private FIX
// and needs no named LP connection, so this panel reads the broker-wide view.
export default function PrivateFIXReadinessPanel({api=privateFixReadiness}){
 const session=useAuthStore(s=>s.accessToken);
 return session?<PrivateFIXWorkspace key={session} api={api}/>:null;
}

const yesNo=v=>v?'yes':'no';

function PrivateFIXWorkspace({api}){
 const [view,setView]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const generation=useRef(0);
 async function load(){
  const token=++generation.current;setBusy(true);setError('');
  try{const value=await api.get();if(token===generation.current)setView(value);}
  catch(e){if(token===generation.current){setView(null);setError(e.message);}}
  finally{if(token===generation.current)setBusy(false);}
 }
 useEffect(()=>{load();return()=>{generation.current++;};},[]); // eslint-disable-line react-hooks/exhaustive-deps -- load once per session.
 const b=view?.recovery_backlog;
 return <section className="private-fix-readiness" aria-label="B-book private FIX readiness">
  <header><h2>B-book private FIX readiness</h2><p>Independent of any named LP connection.</p></header>
  <button type="button" disabled={busy} onClick={load}>Reload readiness</button>
  {error&&<p role="alert">{error}</p>}{busy&&<p role="status">Loading private FIX readiness...</p>}
  {view&&<>
   <p data-state={view.ready?'ready':'not-ready'}>{view.ready?'READY':'NOT READY'}: {PRIVATE_FIX_CODES[view.last_error_code]}{view.last_error_code&&<> (<code>{view.last_error_code}</code>)</>}</p>
   <dl>
    <dt>Deployment</dt><dd>{view.deployment}</dd>
    <dt>Session</dt><dd>{view.session.replace('_',' ')}</dd>
    <dt>Dispatch schema ready</dt><dd>{yesNo(view.dispatch_schema_ready)}</dd>
    <dt>Composed / live / claiming</dt><dd>{yesNo(view.composed)} / {yesNo(view.lifecycle_live)} / {yesNo(view.claiming)}</dd>
    <dt>Recovery backlog</dt><dd>{b.available?`${b.unacknowledged}${b.truncated?'+':''} unacknowledged, ${b.possibly_sent} possibly sent, oldest ${b.oldest_age_seconds}s`:'unavailable'}</dd>
    <dt>Observed</dt><dd>{view.observed_at}</dd>
   </dl>
  </>}
 </section>;
}
