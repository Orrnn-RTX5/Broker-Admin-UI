import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=name=>readFileSync(new URL('./'+name,import.meta.url),'utf8');

test('pending Modify is gated on the server flags and a fresh read; only the exact path is versioned',()=>{
 const text=source('PendingTradeControls.jsx');
 assert.match(text,/const route=editing\?pendingModifyPath\(current,canModify===true\):null,modifiable=route!==null/);
 assert.match(text,/\{modifiable&&<button type="button"[^>]*onClick=\{\(\)=>prepare\('modify'\)\}>Review pending changes<\/button>\}/);
 assert.match(text,/fresh=await readCurrent\(\),path=pendingModifyPath\(fresh,canModify===true\);\s*if\(!path\)throw/);
 assert.match(text,/if\(path==='exact'\)input\.expected_version=fresh\.state_version/);
 assert.match(text,/if\(path==='legacy'\)legacyLevels\(input,fresh\)/);
 const modify=text.slice(text.indexOf("else if(action==='modify')"),text.indexOf('setReview({action:reviewAction,input'));
 assert.doesNotMatch(modify,/input\.(sl|tp|price_limit|trailing)/);
 // Legacy rows use the unversioned legacy entry; exact rows the versioned one.
 assert.match(text,/pendingReview\.action==='legacy modify'\?await modifyManagerLegacyPendingOrder\(/);
 assert.doesNotMatch(text,/const legacyLevels[^\n]*expected_version/);
 assert.match(text,/pendingReadbackMatches\(row,result,input\)/);
 // A route-absent fallback row has unknown terms: say so instead of showing none/undefined.
 assert.match(text,/current\.legacy_fallback\?<p role="status">Current terms are unavailable/);
 assert.match(text,/canModify\?\?=canTrade&&hasPermission\(user,PERMISSION_KEYS\.MANIPULATE_TRADES\)/);
 assert.doesNotMatch(text,/fetch\(|api\.(post|put|patch)|localStorage/);
});

test('position SL/TP is gated on the server flags, never sends trailing; exact settles only on readback',()=>{
 const text=source('PositionProtectionControls.jsx');
 assert.match(text,/permitted=canTrade===true&&hasPermission\(user,PERMISSION_KEYS\.MANIPULATE_TRADES\)/);
 assert.match(text,/route=protectionPath\(current,permitted\),allowed=route!==null/);
 assert.match(text,/\{allowed&&<>/);
 assert.match(text,/const path=protectionPath\(fresh,permitted\);\s*if\(!path\)throw/);
 assert.match(text,/await \(path==='legacy'\?legacySettle:settle\)\(result,input\)/);
 assert.match(text,/protectionReadbackMatches\(row,result,input\)/);
 assert.match(text,/current\.legacy_fallback\?<p role="status">Current protections are unavailable/);
 assert.match(text,/current\.legacy_fallback\?'':' at protection version '\+current\.protection_version/);
 assert.match(text,/Protection edits are unavailable for this position\./);
 assert.doesNotMatch(text,/trailing_(stop|step)/);
 assert.doesNotMatch(text,/fetch\(|api\.(post|put|patch)|localStorage/);
});
