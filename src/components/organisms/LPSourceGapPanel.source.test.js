import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const src=readFileSync(new URL('./LPSourceGapPanel.jsx',import.meta.url),'utf8');
const mount=readFileSync(new URL('./NamedLPConnectionsPanel.jsx',import.meta.url),'utf8');

test('release is offered only after resume and a first fresh quote',()=>{
 assert.match(src,/const key=holdKey\(hold\),state=releaseState\(hold\)/);
 assert.match(src,/state\.allowed\?<button type="button" disabled=\{busy\} onClick=\{\(\)=>openConfirm\(hold\)\}>Release hold<\/button>:<><button type="button" disabled title=\{state\.reason\}>/);
 assert.match(src,/RELEASE_CONFIRM_TEXT/);
 assert.match(src,/minLength=\{8\} maxLength=\{256\}/);
 assert.match(src,/Release recorded; awaiting status refresh/);
});

test('the policy is shown but never editable',()=>{
 assert.match(src,/Hold until operator release/);
 assert.doesNotMatch(src,/evaluate_first_fresh/);
 assert.doesNotMatch(src,/policy_pending\s*[:=]|setPolicy|aria-label="[^"]*[Pp]olicy/);
 assert.doesNotMatch(src,/localStorage|sessionStorage/);
});

test('status polls every 5 s while visible with a stale-generation guard',()=>{
 assert.match(src,/const POLL_MS=5000;/);
 assert.match(src,/if\(!hidden\(\)\)poll\(\)/);
 assert.match(src,/visibilitychange/);
 assert.match(src,/if\(token!==generation\.current\)return;/);
 assert.match(src,/aria-label="Source continuity"/);
});

test('mounted once as a sibling right after the runtime readiness panel',()=>{
 assert.equal(mount.match(/<LPSourceGapPanel /g)?.length,1);
 assert.match(mount,/<LPRuntimeReadinessPanel [^\n]*\/>\}\n\s*\{config\.revision > 0 && <LPSourceGapPanel /);
});
