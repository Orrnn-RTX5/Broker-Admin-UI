import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSourceGapStatus,sourceGapReleasePayload,validateSourceGapReleaseResponse,releaseState,createLPSourceGapsAPI,namedFeedID,holdKey,TYPED_OFF_MESSAGE} from './lpSourceGaps.js';

const bigTicket='9007199254740993';
const feed='namedlp.v1.'+'a'.repeat(64);
const hold=(patch={})=>({entity_kind:'pending',ticket_text:bigTicket,order_version:'9007199254740995',account_login:'100200',symbol:'BTCUSD',feed,partition:3,gap_ids:['gap-1'],gap_reason:'provider_session_lost',opened_at:'2026-09-28T10:00:00Z',resumed:true,first_fresh_seen:true,policy:'hold',...patch});
const status=(patch={})=>({typed:true,available:true,policy_pending:'hold',policy_protection:'hold',degraded:true,unresumed_gaps:0,open_symbol_gaps:1,held_business:1,recorded_gaps:4,observed_at:'2026-09-28T10:01:00Z',holds:[hold()],...patch});
const ok=data=>({ok:true,json:async()=>data});

test('status keeps tickets and versions as decimal strings above 2^53',()=>{
 const v=validateSourceGapStatus(status());
 assert.equal(v.holds[0].ticket_text,bigTicket);
 assert.equal(typeof v.holds[0].order_version,'string');
 assert.equal(holdKey(v.holds[0]),'pending:'+bigTicket+':9007199254740995');
 for(const patch of [{ticket_text:Number(bigTicket)},{ticket_text:'0'},{ticket_text:'01'},{ticket_text:'9223372036854775808'},{order_version:3},{order_version:'-1'}])assert.throws(()=>validateSourceGapStatus(status({holds:[hold(patch)]})));
});

test('policy values other than hold fail validation',()=>{
 for(const patch of [{policy_pending:'evaluate_first_fresh'},{policy_protection:'evaluate_first_fresh'},{policy_pending:undefined}])assert.throws(()=>validateSourceGapStatus(status(patch)));
 assert.throws(()=>validateSourceGapStatus(status({holds:[hold({policy:'evaluate_first_fresh'})]})));
});

test('status refuses malformed holds, duplicates and unknown reasons; tolerates additive fields',()=>{
 for(const patch of [{entity_kind:'position'},{gap_reason:'unknown'},{gap_ids:[]},{resumed:'yes'},{first_fresh_seen:true,resumed:false},{opened_at:'x'},{symbol:''},{partition:-1}])assert.throws(()=>validateSourceGapStatus(status({holds:[hold(patch)]})));
 assert.throws(()=>validateSourceGapStatus(status({holds:[hold(),hold()]})));
 assert.throws(()=>validateSourceGapStatus(status({held_business:-1})));
 assert.throws(()=>validateSourceGapStatus(status({degraded:'no'})));
 assert.equal(validateSourceGapStatus(status({future:1,holds:[hold({future:true,connection_id:'named-one'})]})).holds.length,1);
});

test('typed:false and unavailable shapes are explicit and carry no holds',()=>{
 const off=validateSourceGapStatus({typed:false});
 assert.equal(off.typed,false);assert.equal(off.message,TYPED_OFF_MESSAGE);assert.deepEqual(off.holds,[]);
 const down=validateSourceGapStatus({typed:true,available:false});
 assert.equal(down.available,false);assert.deepEqual(down.holds,[]);
 assert.throws(()=>validateSourceGapStatus({}));
});

test('release requires resume and a first fresh quote',()=>{
 assert.equal(releaseState(hold()).allowed,true);
 assert.match(releaseState(hold({resumed:false,first_fresh_seen:false})).reason,/resume/);
 assert.match(releaseState(hold({first_fresh_seen:false})).reason,/first fresh/);
});

test('release body sends the ticket as a string and bounds the reference',()=>{
 const body=sourceGapReleasePayload({...hold(),reference:'  INC-2026-0928  '});
 assert.deepEqual(body,{entity_kind:'pending',ticket:bigTicket,order_version:'9007199254740995',reference:'INC-2026-0928'});
 assert.equal(JSON.stringify(body).includes('"ticket":"'+bigTicket+'"'),true);
 for(const reference of ['','short','       1234567','x'.repeat(257),'é'.repeat(129)])assert.throws(()=>sourceGapReleasePayload({...hold(),reference}));
 assert.equal(sourceGapReleasePayload({...hold(),reference:'x'.repeat(256)}).reference.length,256);
 assert.throws(()=>sourceGapReleasePayload({...hold({ticket_text:Number(bigTicket)}),reference:'INC-2026-0928'}));
 assert.throws(()=>sourceGapReleasePayload({...hold({entity_kind:'position'}),reference:'INC-2026-0928'}));
});

test('release response must confirm at least one released hold',()=>{
 assert.equal(validateSourceGapReleaseResponse({released:1,partition:3,release_stream_sequence:'18446'}).released,1);
 for(const v of [{released:0,partition:3,release_stream_sequence:'1'},{released:1,partition:3,release_stream_sequence:1},{}])assert.throws(()=>validateSourceGapReleaseResponse(v));
});

test('API posts only the strict body and maps server reason codes without leaking messages',async()=>{
 const calls=[];let response=ok({released:2,partition:3,release_stream_sequence:'77'});
 const api=createLPSourceGapsAPI(async(path,options)=>{calls.push({path,...options});return response;});
 await api.release({...hold(),reference:'INC-2026-0928',extra:'dropped'});
 assert.equal(calls[0].path,'/api/v1/manager/lp-runtime/source-gaps/release');
 assert.equal(calls[0].method,'POST');
 assert.deepEqual(Object.keys(JSON.parse(calls[0].body)),['entity_kind','ticket','order_version','reference']);
 for(const [code,field] of [['SOURCE_GAP_NOT_CLOSED','error_code'],['TRIGGER_RECOVERY_REQUIRED','error'],['SOURCE_GAP_HOLD_NOT_FOUND','error_code'],['SOURCE_GAP_RELEASE_UNAVAILABLE','error_code'],['LP_FORBIDDEN','error_code']]){
  response={ok:false,json:async()=>({[field]:code,message:'private backend detail'})};
  await assert.rejects(api.release({...hold(),reference:'INC-2026-0928'}),e=>e.code===code&&!e.message.includes('private'));
 }
 response={ok:false,json:async()=>({error_code:'TRIGGER_RECOVERY_REQUIRED'})};
 await assert.rejects(api.release({...hold(),reference:'INC-2026-0928'}),/audited recovery/);
 response=ok(status());
 assert.equal((await api.status()).holds.length,1);
 assert.equal(calls.at(-1).path,'/api/v1/manager/lp-runtime/source-gaps');
 assert.equal(calls.at(-1).method,'GET');
});

test('named feed identity matches the backend NamedFeedID derivation',async()=>{
 // sha256("16:trivanta-markets17:trivanta-demo-btc1:2"), the Go fmt material.
 assert.equal(await namedFeedID('trivanta-markets','trivanta-demo-btc',2),'namedlp.v1.fd368dae99db1c9d1d3b74785d1b7ad9651022876be0f001a6e14d4447c044ad');
 assert.equal(await namedFeedID('','x',1),null);
 assert.equal(await namedFeedID('t','x',0),null);
 assert.equal(await namedFeedID('tenant','cönnection',1),null);
});
