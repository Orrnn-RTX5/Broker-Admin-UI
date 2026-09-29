import assert from 'node:assert/strict';
import test from 'node:test';
import { createLPFeeds,feedSelectionPayload,matchingFeedSnapshot } from './lpFeeds.js';
test('account source payload preserves exact revisions and rejects numeric revisions',()=>{
 assert.deepEqual(feedSelectionPayload('9007199254740993','named-one'),{expected_revision:'9007199254740993',connection_id:'named-one'});
 assert.throws(()=>feedSelectionPayload(3,'named-one'));assert.throws(()=>feedSelectionPayload('0','../other'));
});
test('quotes cannot cross source, connection revision or instrument identity',()=>{
 const c={source_id:'one',connection_revision:'9007199254740993',catalog:[{symbol:'EURUSD',provider_instrument_id:'7'}]};
 const t={source_id:'one',connection_revision:c.connection_revision,published_at_ms:1,ticks:{EURUSD:{symbol:'EURUSD',provider_instrument_id:'7',bid:'1.000000000000000001',ask:'1.2',received_at_ms:1,precision:'float64_observation'}}};
 assert.equal(matchingFeedSnapshot('one',c,t).ticks.EURUSD.bid,'1.000000000000000001');
 assert.throws(()=>matchingFeedSnapshot('two',c,t));assert.throws(()=>matchingFeedSnapshot('one',c,{...t,connection_revision:'2'}));
 assert.throws(()=>matchingFeedSnapshot('one',c,{...t,ticks:{EURUSD:{...t.ticks.EURUSD,provider_instrument_id:'other'}}}));
});
test('exact FIX prices retain decimal text and only known valid observations pass',()=>{
 const catalog={source_id:'real-fix',connection_revision:'9007199254740993',catalog:[{symbol:'BTCUSD',provider_instrument_id:'BTCUSD'}]};
 const tick={symbol:'BTCUSD',provider_instrument_id:'BTCUSD',bid:'67890.123456789012345678',ask:'67890.123456789012345679',received_at_ms:1790533000000,precision:'exact_fix'};
 const ticks={source_id:'real-fix',connection_revision:catalog.connection_revision,published_at_ms:1790533000001,ticks:{BTCUSD:tick}};
 const observed=matchingFeedSnapshot('real-fix',catalog,ticks);
 assert.strictEqual(observed.ticks.BTCUSD.bid,tick.bid);
 assert.strictEqual(observed.ticks.BTCUSD.ask,tick.ask);
 assert.strictEqual(observed.ticks.BTCUSD.precision,'exact_fix');
 for(const change of [{precision:'rounded'},{bid:67890.123456789},{ask:'6.789e4'},{bid:'-1'},{ask:'1'.repeat(513)},{symbol:'OTHER'}]){
  assert.throws(()=>matchingFeedSnapshot('real-fix',catalog,{...ticks,ticks:{BTCUSD:{...tick,...change}}}),/Feed observation is unavailable/);
 }
 assert.throws(()=>matchingFeedSnapshot('real-fix',catalog,{...ticks,ticks:{OTHER:{...tick,symbol:'OTHER'}}}),/Feed observation is unavailable/);
});
test('only explicit selection API changes source, with expected revision',async()=>{
 const requests=[];const api=createLPFeeds(async(path,options)=>{requests.push({path,...options});return {ok:true,json:async()=>({})};});
 await api.ticks('named-one');await api.saveAccount('00000000-0000-0000-0000-000000000001','4','named-one');
 assert.equal(requests[0].method,'GET');assert.equal(requests[1].method,'PUT');assert.deepEqual(JSON.parse(requests[1].body),{expected_revision:'4',connection_id:'named-one'});
});

test('group defaults and inheritance preserve independent exact revisions',async()=>{const calls=[];const api=createLPFeeds(async(path,options)=>{calls.push({path,body:options.body&&JSON.parse(options.body)});return {ok:true,json:async()=>({})};});await api.saveGroup('group / one','9007199254740993','named-one');await api.inheritAccount('11111111-1111-1111-1111-111111111111','2');assert.equal(calls[0].path.endsWith('/groups/group%20%2F%20one'),true);assert.equal(calls[0].body.expected_revision,'9007199254740993');assert.deepEqual(calls[1].body,{expected_revision:'2',mode:'inherit'});assert.throws(()=>api.inheritAccount('11111111-1111-1111-1111-111111111111',2));});
