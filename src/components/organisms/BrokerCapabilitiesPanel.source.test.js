import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const src=readFileSync(new URL('./BrokerCapabilitiesPanel.jsx',import.meta.url),'utf8');

test('changes use the loaded revision and lock after an error until reload',()=>{
 assert.match(src,/api\.change\(item\.key,item\.revision,desired,reason\)/);
 assert.match(src,/setError\(e\.message\);setLocked\(true\);/);
 assert.match(src,/disabled=\{busy\|\|locked\|\|blocked\}/);
 assert.match(src,/locked=\{locked\|\|!view\.registry_ready\}/);
 assert.match(src,/const session=useAuthStore/);
 assert.doesNotMatch(src,/localStorage|sessionStorage/);
});

test('server reasons render verbatim and deployment gates have no control',()=>{
 assert.match(src,/r\.required_step/);
 assert.match(src,/item\.change_blockers/);
 const env=src.slice(src.indexOf('Deployment-gated features (read only)'));
 assert.doesNotMatch(env,/<button|<input|onClick|onChange/);
 // The panel never derives effective state itself.
 assert.doesNotMatch(src,/desired_enabled&&|prerequisites_met&&/);
});
