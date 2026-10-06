export default function LPClosedRecoveryRead({recovery:r}){
 if(!r)return null;
 const state={ready:'Recorded for evaluation',policy_unconfigured:'Recovery policy not configured',claimed:'Recovery attempt claimed',unknown:'Recovery outcome unknown',released:'Historical release receipt recorded'}[r.state];
 return <section aria-label="Closed allocation recovery schedule"><h3>Closed allocation recovery schedule</h3>
 <p>Stored scheduler progress only. This is not current provider flatness, live session readiness, financial completion or native-fee reconciliation.</p>
 <dl>{[['Stored state',state],['Attempt',r.attempt],['Pinned recovery settings revision',r.settings_revision??'Not pinned'],['Recorded next attempt at',r.next_attempt_at],['Recorded attempt deadline',r.deadline??'Not claimed'],['Paced at database observation',r.paced?'Waiting for recorded pacing window':'No pacing wait recorded'],['Scoped durable release receipt',r.release_recorded?'Recorded historically':'Not recorded']].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
 {r.state==='unknown'&&<p>The result remains uncertain. A retry is not proof of a successful release.</p>}
 {r.state==='policy_unconfigured'&&<p>An explicit recovery-read policy is required before this schedule can attempt recovery.</p>}
 <p>This view cannot retry, release locks, send orders or reconcile fees.</p></section>;
}
