const object=value=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const keys=(value,allowed,required=allowed)=>object(value)&&Object.keys(value).every(key=>allowed.includes(key))&&required.every(key=>Object.hasOwn(value,key));
const unicode=value=>{for(let i=0;i<value.length;i++){const c=value.charCodeAt(i);if(c>=0xd800&&c<=0xdbff){const next=value.charCodeAt(++i);if(!(next>=0xdc00&&next<=0xdfff))return false;}else if(c>=0xdc00&&c<=0xdfff)return false;}return true;};
const text=value=>typeof value==='string'&&unicode(value);
export const canonicalPendingDecimal=value=>{
 if(typeof value!=='string'||!/^(0|[1-9][0-9]{0,19})(\.[0-9]{1,18})?$/.test(value))throw Error('Enter an exact positive decimal with up to 18 decimal places.');
 const [whole,fraction='']=value.split('.'),tail=fraction.replace(/0+$/,'');
 const result=whole+(tail?'.'+tail:'');if(result==='0')throw Error('Volume and price must be positive.');return result;
};
const nullableDecimal=value=>{if(typeof value!=='string')throw Error('Pending decimal terms must be exact strings.');if(value==='0'||/^0\.0{1,18}$/.test(value))return '0';return canonicalPendingDecimal(value);};
export function normalizeNativePendingDraft(input){
 const allowed=['account_login','symbol','type','volume','price','price_limit','sl','tp','expiry','comment'];
 if(!keys(input,allowed,['account_login','symbol','type','volume','price']))throw Error('Invalid pending draft fields.');
 const login=input.account_login;
 if(!Number.isSafeInteger(login)||login<=0||!text(input.symbol)||!text(input.type)||!text(input.comment??''))throw Error('Invalid pending account or text.');
 const symbol=input.symbol.trim().toUpperCase(),type=input.type.trim().toLowerCase();
 if(!symbol||new TextEncoder().encode(symbol).length>128||!['buy_limit','sell_limit','buy_stop','sell_stop'].includes(type)||new TextEncoder().encode(input.comment??'').length>256)throw Error('Select a supported limit or stop draft.');
 const draft={account_login:login,symbol,type,volume:canonicalPendingDecimal(input.volume),price:canonicalPendingDecimal(input.price)};
 for(const name of ['price_limit','sl','tp'])if(input[name]!==undefined&&input[name]!==null)draft[name]=nullableDecimal(input[name]);
 if(input.expiry!==undefined&&input.expiry!==null){if(!Number.isSafeInteger(input.expiry)||input.expiry<=0||input.expiry>253402300799)throw Error('Expiry must be exact UTC Unix seconds.');draft.expiry=input.expiry;}
 if(input.comment)draft.comment=input.comment;
 return draft;
}
export const nativePendingDraftJSON=draft=>JSON.stringify(draft).replace(/[<>&\u2028\u2029]/g,char=>({'<':'\\u003c','>':'\\u003e','&':'\\u0026','\u2028':'\\u2028','\u2029':'\\u2029'}[char]));
export async function nativePendingDraftFingerprint(draft){
 if(!globalThis.crypto?.subtle)throw Error('Secure draft verification is unavailable.');
 const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('native-pending-draft-v1:'+nativePendingDraftJSON(draft)));
 return [...new Uint8Array(hash)].map(value=>value.toString(16).padStart(2,'0')).join('');
}
const reasons=new Set(['AVAILABLE','LP_PENDING_AUTHORITY_REQUIRED','LP_PROTECTION_UNSUPPORTED','LP_CAPABILITY_UNSUPPORTED','LP_QUANTITY_UNREPRESENTABLE','LP_EVIDENCE_REQUIRED','LP_ADMISSION_UNAVAILABLE','LP_ROUTING_REJECTED','LP_FEED_MISMATCH','CLEANUP_POLICY_UNCONFIGURED','READ_UNAVAILABLE','FORBIDDEN','NOT_FOUND','BROKER_NOT_FOUND','BROKER_INACTIVE','LICENSE_EXPIRED','SYMBOL_NOT_ALLOWED']);
export async function validateNativePendingAdvisory(value,draft,{startedAt=Date.now(),now=()=>Date.now()}={}){
 const invalid=()=>{throw Error('The placement check is unavailable or no longer matches this draft.');};
 if(!keys(value,['kind','draft','fingerprint','available','reason','evaluated_at','valid_until','constraints'],['kind','draft','fingerprint','available','reason','evaluated_at','valid_until'])
  ||value.kind!=='native_pending_draft'||typeof value.available!=='boolean'||!reasons.has(value.reason)||value.available!==(value.reason==='AVAILABLE')
  ||typeof value.fingerprint!=='string'||!/^[0-9a-f]{64}$/.test(value.fingerprint))invalid();
 const canonical=normalizeNativePendingDraft(draft);
 if(!object(value.draft)||Object.keys(value.draft).length!==Object.keys(canonical).length||Object.entries(canonical).some(([key,item])=>!Object.hasOwn(value.draft,key)||value.draft[key]!==item))invalid();
 if(value.fingerprint!==await nativePendingDraftFingerprint(canonical))invalid();
 // The Gateway emits UTC RFC3339Nano. Date.parse alone normalizes invalid
 // calendar dates (for example February 30), so require a UTC round trip.
 const timestamp=text=>{
  if(typeof text!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?Z$/.test(text))return NaN;
  const value=Date.parse(text);
  return Number.isFinite(value)&&new Date(value).toISOString().slice(0,19)===text.slice(0,19)?value:NaN;
 };
 const evaluated=timestamp(value.evaluated_at),until=timestamp(value.valid_until),current=now();
 if(!Number.isFinite(evaluated)||!Number.isFinite(until)||evaluated<startedAt-5000||evaluated>current+1000||until<evaluated||until-evaluated>2000)invalid();
 if(!value.available){if(value.constraints!==undefined&&value.constraints!==null)invalid();return {...value,validUntil:until};}
 if(until<=current||canonical.expiry!==undefined&&canonical.expiry*1000<=current||['sl','tp','price_limit'].some(name=>Object.hasOwn(canonical,name)))invalid();
 const c=value.constraints;
 if(!keys(c,['volume_step','volume_scale','price_tick','price_scale'])||![c.volume_scale,c.price_scale].every(scale=>Number.isInteger(scale)&&scale>=0&&scale<=18))invalid();
 if(canonicalPendingDecimal(c.volume_step)!==c.volume_step||canonicalPendingDecimal(c.price_tick)!==c.price_tick)invalid();
 return {...value,validUntil:until};
}
export function matchingSavedPlacement(records,draft){
 const signature=nativePendingDraftJSON(normalizeNativePendingDraft(draft));
 for(const record of records){
  const terms=Object.fromEntries(Object.entries(record).filter(([name])=>name!=='client_order_id'&&name!=='require_native'));
  // An older unsupported placement may coexist; it is still shown by recovery.
  try{if(nativePendingDraftJSON(normalizeNativePendingDraft(terms))===signature)return record;}catch{/* Not the same supported draft. */}
 }
 return null;
}

// A datetime-local field is explicitly UTC here, never the workstation timezone.
export function nativePendingUTCExpiry(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.0{1,3})?)?$/.test(value))throw Error('Choose a valid expiry date and time in UTC.');
 const seconds=value.replace(/\.0{1,3}$/, '');
 const exact=seconds.length===16?seconds+':00':seconds;
 const milliseconds=Date.parse(exact+'Z');
 if(!Number.isFinite(milliseconds)||milliseconds<=0||new Date(milliseconds).toISOString().slice(0,19)!==exact)throw Error('Choose a valid expiry date and time in UTC.');
 return milliseconds/1000;
}