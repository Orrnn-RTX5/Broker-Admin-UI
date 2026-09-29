import test from 'node:test';

test('maximum exact decimals never round and invalid UTC dates or GTD encodings are refused',async()=>{
 const huge='99999999999999999999.999999999999999999';
 const exact=normalizeNativePendingDraft({...draft(),volume:huge,price:huge,expiry:253402300799});
 assert.equal(exact.volume,huge);assert.equal(exact.price,huge);assert.equal(exact.expiry,253402300799);
 for(const expiry of ['2000000000',2000000000.5,0,-1,9007199254740992,253402300800])assert.throws(()=>normalizeNativePendingDraft({...draft(),expiry}));
 const current=Date.parse('2026-03-02T00:00:00Z'),value=await response(draft(),current);
 value.evaluated_at='2026-02-30T00:00:00Z';value.valid_until='2026-03-02T00:00:02Z';
 await assert.rejects(validateNativePendingAdvisory(value,draft(),{startedAt:current,now:()=>current}));
 value.evaluated_at='2026-03-02T00:00:00Z';
 assert.equal((await validateNativePendingAdvisory(value,draft(),{startedAt:current,now:()=>current})).available,true);
});
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {nativePendingUTCExpiry,normalizeNativePendingDraft,nativePendingDraftJSON,nativePendingDraftFingerprint,validateNativePendingAdvisory,matchingSavedPlacement} from './nativePendingAdvisory.js';
if(!globalThis.crypto)Object.defineProperty(globalThis,'crypto',{value:webcrypto});
const draft=()=>normalizeNativePendingDraft({account_login:1001,symbol:' eurusd ',type:'BUY_STOP',volume:'0.050000000000000001',price:'1.123456789012345678'});
const response=async(d=draft(),now=Date.now())=>({kind:'native_pending_draft',draft:d,fingerprint:await nativePendingDraftFingerprint(d),available:true,reason:'AVAILABLE',evaluated_at:new Date(now).toISOString(),valid_until:new Date(now+2000).toISOString(),constraints:{volume_step:'0.000000000000000001',volume_scale:18,price_tick:'0.000000000000000001',price_scale:18}});
test('native draft keeps exact decimals and matches Go fixed-order escaped fingerprint',async()=>{
 const input={...draft(),price:'1.230000000000000000',expiry:null,sl:null,comment:'<>&\u2028\u2029😀'};
 const normalized=normalizeNativePendingDraft(input);
 assert.equal(normalized.price,'1.23');assert.equal(normalized.volume,'0.050000000000000001');assert.equal(Object.hasOwn(normalized,'expiry'),false);assert.equal(Object.hasOwn(normalized,'sl'),false);
 const json='{"account_login":1001,"symbol":"EURUSD","type":"buy_stop","volume":"0.050000000000000001","price":"1.23","comment":"\\u003c\\u003e\\u0026\\u2028\\u2029😀"}';
 assert.equal(nativePendingDraftJSON(normalized),json);
 assert.equal(await nativePendingDraftFingerprint(normalized),createHash('sha256').update('native-pending-draft-v1:'+json).digest('hex'));
 for(const patch of [{symbol:'bad\ud800'},{comment:'bad\udfff'},{volume:0.1},{price:'1e2'},{volume:'01'},{account_login:['1001']},{sl:['0.0']},{require_native:true}])assert.throws(()=>normalizeNativePendingDraft({...draft(),...patch}));
});
test('advisory requires exact draft fingerprint, fresh times and customer-only shape',async()=>{
 const original=await response(),now=Date.now();
 assert.equal((await validateNativePendingAdvisory(original,draft(),{startedAt:now})).available,true);
 for(const mutate of [
  value=>{value.draft.price='1.2';},value=>{value.draft.account_login=1002;},value=>{value.fingerprint='0'.repeat(64);},
  value=>{value.connection_id='private';},value=>{value.constraints.native_price='1';},value=>{delete value.available;},
  value=>{value.constraints.price_tick='0.0100';},value=>{value.constraints.volume_scale=19;},
  value=>{value.valid_until=new Date(now-1).toISOString();},value=>{value.valid_until=new Date(now+30000).toISOString();},
  value=>{value.reason='provider private detail';},value=>{value.draft.volume=0.05;}
 ]){
  const value=structuredClone(original);mutate(value);await assert.rejects(validateNativePendingAdvisory(value,draft(),{startedAt:now}));
 }
 const refused={...original,available:false,reason:'LP_PENDING_AUTHORITY_REQUIRED',valid_until:original.evaluated_at};delete refused.constraints;
 assert.equal((await validateNativePendingAdvisory(refused,draft(),{startedAt:now})).available,false);
});
test('matching unresolved placement is discovered without replacing saved payload or identity',()=>{
 const original={...draft(),price:'1.1234567890123456780',client_order_id:'original',require_native:true};
 // Invalid scale cannot be coerced to a match.
 assert.equal(matchingSavedPlacement([original],draft()),null);
 const saved={...draft(),volume:'0.050000000000000001',client_order_id:'original',require_native:true};
 assert.equal(matchingSavedPlacement([saved],draft()),saved);
 const old={...draft(),client_order_id:'older'};assert.equal(matchingSavedPlacement([old],draft()),old);
 assert.equal(matchingSavedPlacement([saved],{...draft(),price:'2'}),null);
 assert.equal(saved.require_native,true);
});

test('GTD calendar control uses exact UTC seconds without local DST conversion',()=>{
 for(const value of ['2032-02-29T12:34:56','2032-02-29T12:34:56.000','2032-03-14T02:30','2032-11-07T01:30'])assert.equal(nativePendingUTCExpiry(value),Date.parse(value+(value.length===16?':00Z':'Z'))/1000);
 for(const value of ['2031-02-29T12:00','2032-02-30T12:00','2032-01-01T24:00','2032-01-01T12:00:00.5','2032-01-01T12:00Z','2000000000','0000-01-01T00:00'])assert.throws(()=>nativePendingUTCExpiry(value));
});