import {useEffect,useRef,useState} from 'react';
import {coveragePreviewInput,coveragePreviewWithinGrant,lpCoveragePreview} from '../../services/lpCoveragePreview.js';
import './lp-coverage-preview.css';
export default function LPCoveragePreview({connection,policy,evidence=[],canPreview=false,isAdmin=false,maximumCoverage='',draftKey=''}){
 const [symbol,setSymbol]=useState(''),[lots,setLots]=useState(''),[result,setResult]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const symbols=evidence.filter(e=>e.connection_id===connection).map(e=>e.symbol);
 const allowed=canPreview&&(isAdmin||coveragePreviewWithinGrant(policy,maximumCoverage));
 const fingerprint=JSON.stringify([connection,policy,symbol,lots,draftKey,allowed,evidence.filter(e=>e.connection_id===connection).map(e=>[e.symbol,e.revision,e.connection_revision,e.valid_until])]);
 const current=useRef(fingerprint),generation=useRef(0);current.current=fingerprint;
 useEffect(()=>{generation.current++;setBusy(false);setError('');setResult(null);return()=>{generation.current++;};},[fingerprint]);
 const preview=result?.fingerprint===fingerprint?result.value:null;
 async function run(){
  if(!allowed)return;const key=fingerprint,token=++generation.current;setBusy(true);setError('');setResult(null);
  try{const input=coveragePreviewInput(symbol,lots,policy);const value=await lpCoveragePreview.preview(connection,input);if(current.current===key&&token===generation.current)setResult({fingerprint:key,value});}
  catch(e){if(current.current===key&&token===generation.current)setError(e.message);}
  finally{if(current.current===key&&token===generation.current)setBusy(false);}
 }
 return <section className="lp-coverage-preview" aria-label="Exact coverage preview"><p>Operator-selected exact demo sizing is available only through the account-scoped Demo market order preview; this general coverage preview still requires a verified provider grid.</p><h3>Exact coverage preview</h3>
 <p>Sizing only. This preview does not save the rule or admit an order. Account eligibility, rule scope and live execution checks still apply.</p>
 <div className="lpr-fields"><label>Preview instrument<select value={symbols.includes(symbol)?symbol:''} disabled={busy||!allowed} onChange={e=>setSymbol(e.target.value)}><option value="">Select saved instrument evidence</option>{[...new Set(symbols)].map(s=><option key={s}>{s}</option>)}</select></label><label>Preview customer lots<input inputMode="decimal" value={lots} disabled={busy||!allowed} onChange={e=>setLots(e.target.value)}/></label></div>
 <button type="button" disabled={busy||!allowed||!connection||!symbols.includes(symbol)||!lots} onClick={run}>Preview draft coverage</button>
 {!connection&&<p>Select a named connection with saved verified instrument evidence.</p>}{connection&&!symbols.length&&<p>No saved instrument evidence is available for this connection.</p>}
 {!allowed&&<p>A scoped configuration grant with sufficient coverage is required to preview this draft.</p>}
 {busy&&<p role="status">Calculating exact coverage...</p>}{error&&<p role="alert">{error}</p>}
 {preview&&<div><p role="status">Exact sizing preview. No order admitted.</p><p>{preview.connection_enabled?'Saved connection enabled; execution readiness is not assessed.':'Saved connection is disabled.'}</p>
 <dl>{[['Connection revision',preview.connection_revision],['Instrument evidence revision',preview.evidence_revision],['Quote feed',preview.feed_id],['Evidence source',preview.source],['Evidence reference',preview.evidence_id],['Verified at',preview.verified_at],['Valid until',preview.valid_until],['Evaluated at',preview.evaluated_at],['Minimum LP lots',preview.grid.min_lots],['Maximum LP lots',preview.grid.max_lots],['LP lot step',preview.grid.step_lots],['Lot-grid origin',preview.grid.grid_origin_lots],['Wire units per lot',preview.grid.units_per_lot]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
 {preview.mode==='whole_orders'&&<p>Selected and unselected scenarios show configured probabilities. This preview does not choose a future order.</p>}
 <div className="lpr-table"><table><caption>Server-calculated coverage scenarios</caption><thead><tr>{['Scenario','Probability %','Customer lots','Target LP lots before rounding','LP lots after rounding','Customer-covered LP lots','B-book lots','Broker excess lots','Upward rounding lots','LP wire quantity'].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{preview.scenarios.map(s=><tr key={s.name}><td>{s.name==='volume'?'Volume split':s.name==='selected'?'Selected order':'Unselected order'}</td><td>{s.probability_percent}</td><td>{s.allocation.customer_lots}</td><td>{s.requested_lp_lots}</td><td>{s.allocation.lp_requested_lots}</td><td>{s.allocation.lp_customer_lots}</td><td>{s.allocation.b_book_lots}</td><td>{s.allocation.excess_lots}</td><td>{s.rounding_lots}</td><td>{s.allocation.target_wire_qty}</td></tr>)}</tbody></table></div>
 <p>Customer lots stay exact. LP quantities round upward to the saved provider grid; any LP amount above customer-covered lots is broker excess.</p></div>}
 </section>;
}
