export default function LPClosedAllocationRead({ certificate:c }) {
 if(!c)return null;
 const use=c.configuration_use_state==='released'?'Released':c.configuration_use_state==='unavailable'?'Unavailable':'Held ('+c.configuration_use_state+')';
 return <section aria-label="Historical closed allocation">
  <h3>Historical closed-allocation certificate</h3>
  <p>Stored evidence only, not current live provider flatness. A certificate does not release configuration or settle native fees. Other commands may still hold the same settings.</p>
  <dl>{[['Stored certificates',c.certificate_count],['Latest certificate recorded',c.created_at],['Original connection revision',c.connection_revision],['Historical native observation',c.native_observed_at],['Observation valid until',c.native_valid_until],['Certified customer raw volume',c.certified_raw_volume],['Certified customer wire quantity',c.certified_wire_quantity],['Opening command configuration use',use],['Release recorded',c.release_recorded?'Yes':'No'],['Release recorded at',c.released_at??'Not recorded'],['Financial follow-up','Pending reconciliation'],['Pending native fee evidence records',c.pending_fee_count],['Observed unreconciled fee records',c.observed_fee_count]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
  <p>Broker/LP native fee follow-up is unreconciled provider evidence, not a new customer charge or debt. Unknown amounts and currencies remain unknown. Records may reflect different evidence for the same command; no total is inferred.</p>
  <div className="lp-journal-scroll"><table><thead><tr><th>Native fee evidence</th><th>Observed amount</th><th>Currency</th><th>Recorded</th></tr></thead><tbody>{c.fees.map((fee,index)=><tr key={index}><td>{fee.status==='pending_evidence'?'Pending evidence':'Observed, unreconciled'}</td><td>{fee.amount??'Unknown'}</td><td>{fee.currency??'Unknown'}</td><td>{fee.created_at}</td></tr>)}</tbody></table></div>
  {c.fees_truncated&&<p>Showing the latest 100 evidence records. Counts include all scoped records.</p>}
 </section>;
}
