const decimal=/^(0|[1-9][0-9]*)(\.[0-9]{1,18})?$/;
const SCALE=10n**18n;
const units=v=>BigInt(v.split('.')[0])*SCALE+BigInt((v.split('.')[1]||'').padEnd(18,'0'));
const canonical=v=>typeof v==='string'&&decimal.test(v)&&v.replace('.','').length<=38&&(!v.includes('.')||!v.endsWith('0'));
const text=n=>{const whole=n/SCALE,frac=(n%SCALE).toString().padStart(18,'0').replace(/0+$/,'');return frac?`${whole}.${frac}`:`${whole}`;};
export const exactDemoSizingNotice='Operator-selected exact demo size; provider quantity grid unverified.';
export const EXACT_DEMO_UNVERIFIED_GRID_BASIS='operator_expected_provider_wire_unverified';
export const exactDemoHybridNotice='UNVERIFIED provider grid: the lot grid and wire conversion are the operator\'s expected provider values, approved in Admin, not verified with the provider.';
// User decision 2026-09-28: expected, UNVERIFIED provider wire per 0.01 lot
// (XAUUSD 1, EURUSD 1000; BTCUSD per the existing exact evidence). Applied
// only when the operator explicitly asks; never a saved default.
export const expectedUnverifiedUnitsPerLot=Object.freeze({XAUUSD:'100',EURUSD:'100000',BTCUSD:'1'});
const splitKeys=['provider_grid_unverified','grid_basis','contract_id','min_lots','step_lots','max_lots','grid_origin_lots','coverage_percent','requested_lp_lots','external_lots','b_book_lots','excess_lots'];
export const exactDemoSplitContractKeys=Object.freeze(['contract_id','min_lots','step_lots','max_lots','grid_origin_lots','coverage_percent']);
// Mirrors lp.PlanExactDemoSplit: upward rounding of the external leg only,
// refusal (never rounding) when either leg would leave the approved grid.
export function planExactDemoSplit(customerLots,unitsPerLot,contract){
 const fail=reason=>{throw Error(`Hybrid split refused: ${reason}.`);};
 if(!contract||contract.provider_grid_unverified!==true||contract.grid_basis!==EXACT_DEMO_UNVERIFIED_GRID_BASIS||typeof contract.contract_id!=='string'||!contract.contract_id||contract.contract_id.length>128||/[\x00-\x20]/.test(contract.contract_id))fail('explicit unverified provider grid contract required');
 const values=[customerLots,unitsPerLot,contract.min_lots,contract.step_lots,contract.max_lots,contract.grid_origin_lots,contract.coverage_percent];
 if(!values.every(canonical))fail('canonical nonnegative decimal strings required');
 const [c,u,min,step,max,origin,cov]=values.map(units);
 if(c<=0n||u<=0n||min<=0n||step<=0n||max<min||origin>=step)fail('positive customer, units, minimum and step with maximum >= minimum and origin < step required');
 if(cov<=0n||cov>=100n*SCALE)fail('hybrid coverage must be above 0% and below 100%');
 const onGrid=v=>v>=min&&(v-origin)%step===0n;
 if(!onGrid(c))fail('customer lots must lie on the approved grid so both legs stay on its step');
 const numerator=c*cov;
 if(numerator%(100n*SCALE)!==0n)fail('coverage target exceeds exact decimal precision');
 const target=numerator/(100n*SCALE),lower=target<min?min:target;
 const offset=lower-origin,count=offset>0n?(offset+step-1n)/step:0n,external=origin+step*count;
 if(external>max)fail('rounded external leg exceeds the approved maximum');
 if(!onGrid(external))fail('external leg violates the approved minimum/step');
 const owned=external>c?c:external,bbook=c-owned,excess=external-owned,wire=external*u;
 // wire is scaled by 10^36; the adapter accepts only hundredth-unit wire.
 if(wire%(SCALE*SCALE/100n)!==0n)fail('external wire quantity requires positive hundredth-unit precision');
 if(excess!==0n)fail('broker-owned excess is not closable under whole-position exact-demo authority');
 if(bbook===0n)fail('upward rounding leaves no B-book remainder; use the fixed 100% exact authority');
 const split={provider_grid_unverified:true,grid_basis:EXACT_DEMO_UNVERIFIED_GRID_BASIS,contract_id:contract.contract_id,min_lots:contract.min_lots,step_lots:contract.step_lots,max_lots:contract.max_lots,grid_origin_lots:contract.grid_origin_lots,coverage_percent:contract.coverage_percent,requested_lp_lots:text(target),external_lots:text(external),b_book_lots:text(bbook),excess_lots:text(excess)};
 return {split,wire_quantity:text(wire/SCALE)};
}
function readSplit(v,sizing){
 const fail=()=>{throw Error('Hybrid split must be an Admin-approved, explicitly UNVERIFIED provider grid contract matching its exact recomputation.');};
 if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!splitKeys.includes(k))||splitKeys.some(k=>k==='provider_grid_unverified'?v[k]!==true:typeof v[k]!=='string'))fail();
 const planned=planExactDemoSplit(sizing.customer_lots,sizing.units_per_lot,v);
 if(splitKeys.some(k=>planned.split[k]!==v[k])||planned.wire_quantity!==sizing.wire_quantity)fail();
 return {...planned.split};
}
function readSizing(v,scope,now,requireCurrentOpening){
 const fail=()=>{throw Error('Exact demo sizing must match the dedicated account, saved connection, symbol and current authorization.');};
 const keys=['id','tenant_id','broker_id','account_id','account_login','connection_id','connection_revision','symbol','provider_symbol_id','mapping_version','customer_lots','wire_quantity','units_per_lot','authorized_at','opening_valid_until'];
 const hybrid=!!v&&typeof v==='object'&&v.hybrid_split!==undefined&&v.hybrid_split!==null;
 if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!keys.includes(k)&&!(k==='hybrid_split'&&hybrid))||keys.some(k=>typeof v[k]!=='string'))fail();
 if(!['id','tenant_id','broker_id','connection_id','symbol','provider_symbol_id','mapping_version'].every(k=>v[k].length>0&&v[k].length<=128&&!/[\x00-\x20]/.test(v[k]))||v.tenant_id!==v.broker_id||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.account_id)||!['account_login','connection_revision'].every(k=>/^[1-9][0-9]*$/.test(v[k])&&BigInt(v[k])<=9223372036854775807n))fail();
 if(!['customer_lots','wire_quantity','units_per_lot'].every(k=>canonical(v[k])&&units(v[k])>0n))fail();
 if(units(v.wire_quantity)%(10n**16n)!==0n)fail();
 const split=hybrid?readSplit(v.hybrid_split,v):null;
 if(!hybrid&&units(v.customer_lots)*units(v.units_per_lot)!==units(v.wire_quantity)*SCALE)fail();
 if(!['authorized_at','opening_valid_until'].every(k=>/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(v[k])))fail();
 const from=Date.parse(v.authorized_at),until=Date.parse(v.opening_valid_until);
 if(!Number.isFinite(now)||!Number.isFinite(from)||!Number.isFinite(until)||from>now||until<=from||(requireCurrentOpening&&(from>now||until<=now)))fail();
 for(const k of keys)if(scope[k]!==undefined&&v[k]!==scope[k])fail();
 return {...Object.fromEntries(keys.map(k=>[k,v[k]])),...(split?{hybrid_split:split}:{})};
}
export const readExactDemoSizing=(v,scope={},now=Date.now())=>readSizing(v,scope,now,true);
export const readRetainedExactDemoSizing=(v,scope={},now=Date.now())=>readSizing(v,scope,now,false);
// The only preview coverage an exact authority permits: the fixed 100%
// quantity, or the approved hybrid legs. Never broker excess.
export function exactDemoCoverage(sizing){
 const s=sizing.hybrid_split;
 return s?{customer_lots:sizing.customer_lots,lp_requested_lots:s.external_lots,internal_lots:s.b_book_lots,broker_excess_lots:'0'}:{customer_lots:sizing.customer_lots,lp_requested_lots:sizing.customer_lots,internal_lots:'0',broker_excess_lots:'0'};
}
// Same-contract renewal (mirrors lp.ValidateExactDemoSplitRenewal): keeping
// the contract id keeps the unverified grid, conversion and scope unchanged.
export function checkExactDemoSplitRenewal(previous,next){
 if(!previous?.hybrid_split||!next?.hybrid_split||previous.hybrid_split.contract_id!==next.hybrid_split.contract_id)return;
 const p=previous.hybrid_split,n=next.hybrid_split;
 if(n.provider_grid_unverified!==true||['grid_basis','min_lots','step_lots','max_lots','grid_origin_lots'].some(k=>p[k]!==n[k])||['units_per_lot','tenant_id','broker_id','account_id','account_login','connection_id','symbol','provider_symbol_id','mapping_version'].some(k=>previous[k]!==next[k])||Date.parse(next.authorized_at)<Date.parse(previous.authorized_at))throw Error('Same-contract renewal must keep the unverified grid, conversion and scope; use a new contract id to change them.');
}
function validateDemoEvidence(e,now,closeRenewal){
 const scope={connection_id:e.connection_id,connection_revision:e.connection_revision,symbol:e.symbol,provider_symbol_id:e.trade?.provider_symbol_id,mapping_version:e.trade?.symbol_mapping_version};
 const d=(closeRenewal?readRetainedExactDemoSizing:readExactDemoSizing)(e.exact_demo_sizing,scope,now);
 if(e.account_mode!=='hedging'||e.trade?.provider!=='cserver'||e.trade?.environment!=='demo'||e.quote?.environment!=='demo'||e.native_pending||e.native_control||e.grid?.verified!==false||['evidence_id','min_lots','max_lots','step_lots','grid_origin_lots','units_per_lot'].some(k=>e.grid?.[k]!==''))throw Error('Exact demo sizing requires demo hedging, an empty unverified grid, and no pending/control capability.');
 if(!closeRenewal&&(Date.parse(d.authorized_at)<Date.parse(e.verified_at)||Date.parse(d.opening_valid_until)>Date.parse(e.valid_until)))throw Error('Exact demo opening authorization must fit within the capability evidence window.');
 return d;
}
export const validateExactDemoEvidence=(e,now=Date.now())=>validateDemoEvidence(e,now,false);
// A retained opening choice can authorize closing its own inventory after its
// opening window. The server binds it byte-for-byte to the saved original.
export const validateRetainedExactDemoEvidence=(e,now=Date.now())=>validateDemoEvidence(e,now,true);
