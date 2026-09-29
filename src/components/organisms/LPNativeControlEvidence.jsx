export default function LPNativeControlEvidence({value,onChange}) {
 return <fieldset><legend>Optional native cancellation evidence</legend>
  <p>Record cancellation support verified for this pending-order account and instrument. Verification does not enable trading.</p>
  <label className="lpr-check"><input type="checkbox" checked={!!value} onChange={event=>onChange(event.target.checked?{evidence_id:'',source:'',verifier:'',source_reference:'',verified_at:'',valid_until:'',supports_cancel:false}:null)}/>Record separately verified native cancellation capability</label>
  {value&&<><div className="lpr-fields">{[['evidence_id','Native cancellation evidence reference'],['verifier','Cancellation verified by'],['source_reference','Cancellation verification source reference'],['verified_at','Native cancellation verified at (UTC RFC3339)'],['valid_until','Native cancellation valid until (UTC RFC3339)']].map(([key,label])=><label key={key}>{label}<input required maxLength={512} value={value[key]} onChange={event=>onChange({...value,[key]:event.target.value})}/></label>)}
   <label>Native cancellation evidence source<select required value={value.source} onChange={event=>onChange({...value,source:event.target.value})}><option value="">Select provenance</option><option value="provider_spec">Provider specification</option><option value="provider_demo">Provider demo verification</option><option value="simulator">Isolated simulator only</option></select></label></div>
   <label className="lpr-check"><input type="checkbox" checked={value.supports_cancel} onChange={event=>onChange({...value,supports_cancel:event.target.checked})}/>Native cancellation verified</label>
  </>}
 </fieldset>;
}
