import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const src=readFileSync(new URL('./LPExactPendingModifyAdmissionPanel.jsx',import.meta.url),'utf8');
const view=readFileSync(new URL('./GatewaysView.jsx',import.meta.url),'utf8');

test('editor shows default, revision and the exact explanation',()=>{
 assert.match(src,/aria-label="Exact pending Modify admission"/);
 assert.match(src,/Default \$\{MODIFY_ADMISSION_DEFAULT\} \(no saved revision\)\./);
 assert.match(src,/saved revision \$\{record\.revision\}/);
 assert.ok(src.includes("'Counts unsuccessful Modify requests per pending ticket (rejected, expired or still in flight). At the limit the customer must cancel and place a new order. Applies to new Modify requests only; replay of an admitted request is never limited.'"));
});

test('input is an integer 1-128 and save uses the loaded revision, locking after an error',()=>{
 assert.match(src,/type="number" inputMode="numeric" required min=\{MODIFY_ADMISSION_MIN\} max=\{MODIFY_ADMISSION_MAX\} step=\{1\}/);
 assert.match(src,/api\.save\(record\.revision,draft\)/);
 assert.match(src,/setError\(e\.message\);setLocked\(true\);/);
 assert.match(src,/disabled=\{busy\|\|locked\}/);
 assert.match(src,/const session=useAuthStore/);
 assert.doesNotMatch(src,/localStorage|sessionStorage/);
});

test('mounted once in GatewaysView right after the recovery policy panel',()=>{
 assert.equal(view.match(/<LPExactPendingModifyAdmissionPanel \/>/g)?.length,1);
 assert.equal(view.match(/<LPRecoveryPolicyPanel \/>/g)?.length,1);
 // Disclosures may separate the panels, but their order and single mounts must remain.
 assert.ok(view.indexOf('<LPRecoveryPolicyPanel />') < view.indexOf('<LPExactPendingModifyAdmissionPanel />'));
 assert.match(view,/import LPExactPendingModifyAdmissionPanel from '\.\/LPExactPendingModifyAdmissionPanel\.jsx';/);
});
