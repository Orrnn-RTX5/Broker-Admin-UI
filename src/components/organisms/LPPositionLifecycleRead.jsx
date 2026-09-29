export default function LPPositionLifecycleRead({ lifecycle }) {
 if (!lifecycle) return null;
 const unsettled = !/^0(?:\.0+)?$/.test(lifecycle.unsettled_reduction_wire_qty);
 return <section aria-label="Remaining position exposure">
  <h3>Remaining position exposure</h3>
  <p>Saved close and customer settlement evidence. Reported LP remaining is not a fresh provider position snapshot.</p>
  <dl>{[
   ['Customer remaining (raw volume)', lifecycle.customer_remaining_raw_volume],
   ['Customer remaining (wire)', lifecycle.customer_remaining_wire_qty],
   ['Customer closed and settled (wire)', lifecycle.customer_closed_wire_qty],
   ['Reported LP reduction (wire)', lifecycle.reported_close_wire_qty],
   ['Reported LP remaining (wire)', lifecycle.reported_remaining_wire_qty ?? 'Unknown / held'],
   ['LP reduction awaiting customer settlement (wire)', lifecycle.unsettled_reduction_wire_qty],
   ['Intentional broker excess (wire)', lifecycle.intentional_excess_wire_qty],
   ['Active close commands', lifecycle.active_closes],
   ['Held evidence', lifecycle.held_evidence ? 'Yes' : 'No'],
   ['Reconciliation required', lifecycle.reconciliation_required ? 'Yes' : 'No'],
  ].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
  {unsettled && <p role="status">An LP reduction has not settled to the customer. Customer remaining is unchanged by that reduction and requires reconciliation.</p>}
  {lifecycle.held_evidence && <p role="status">Held evidence prevents a confirmed reported remaining quantity. Unknown does not mean zero or flat.</p>}
  <p>Broker excess is separate from customer remaining. This summary does not establish fee settlement or authorize cleanup or lock release.</p>
 </section>;
}
