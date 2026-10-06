import { reportRiskReasons } from '../../services/lpJournal.js';

export default function LPReportRiskRead({ risk }) {
 if (!risk) return null;
 return <section aria-label="LP report reconciliation">
  <h3>Report reconciliation</h3>
  <p role={risk.blocked ? 'status' : undefined}>{risk.blocked ? 'Report reconciliation is required before new execution on this LP account.' : 'No report incidents recorded.'}</p>
  <dl>{[
   ['Account report incidents', risk.trusted_incident_count],
   ['Reports with unverified source', risk.ambiguous_incident_count],
   ['Latest incident', risk.latest_incident_at ?? 'None recorded'],
  ].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
  {risk.reason_codes.length>0 && <ul>{risk.reason_codes.map(code=><li key={code}>{reportRiskReasons[code]}</li>)}</ul>}
  <p>Incidents can affect orders sharing the LP account. Refreshing this view does not resolve them or change customer balances.</p>
 </section>;
}
