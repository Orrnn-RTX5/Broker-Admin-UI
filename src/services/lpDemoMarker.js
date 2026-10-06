const ids=['account_id','group_id','connection_id','rule_id','feed_source_kind','feed_source_group'];
const positive=['connection_revision','rule_version','evidence_revision'];
const revisions=['feed_source_revision','account_selection_revision','selection_revision','grant_revision'];
const keys=['draft_fingerprint',...ids,...positive,...revisions];
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
// A marker binds a preview to an immutable command. It never grants authority.
// Expiry is intentionally not checked here: old accepted work remains recoverable.
export function copyLPDemoMarker(value){
 const fail=()=>{throw new Error('A valid demo preview is required.');};
 if(!object(value)||Object.keys(value).length!==3||value.version!=='lp_demo_market_v1'||typeof value.valid_until!=='string'||!Number.isFinite(Date.parse(value.valid_until))||!object(value.scope)||Object.keys(value.scope).length!==keys.length)fail();
 const s=value.scope;
 if(typeof s.draft_fingerprint!=='string'||!/^[a-f0-9]{64}$/.test(s.draft_fingerprint))fail();
 for(const key of ids)if(typeof s[key]!=='string'||s[key].length>128||/[\r\n\x00]/.test(s[key])||s[key].trim()!==s[key]||(!s[key]&&key!=='feed_source_group'))fail();
 for(const key of [...positive,...revisions])if(typeof s[key]!=='string'||!(/^(0|[1-9][0-9]*)$/).test(s[key])||BigInt(s[key])>9223372036854775807n||(positive.includes(key)&&s[key]==='0'))fail();
 if(Object.keys(s).some(key=>!keys.includes(key)))fail();
 return {version:value.version,scope:Object.fromEntries(keys.map(key=>[key,s[key]])),valid_until:value.valid_until};
}
