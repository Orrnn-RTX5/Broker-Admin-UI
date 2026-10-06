import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const here=dirname(fileURLToPath(import.meta.url));
const panel=readFileSync(join(here,'LPCleanupRecoveryPanel.jsx'),'utf8');
const journal=readFileSync(join(here,'LPJournalPanel.jsx'),'utf8');
const service=readFileSync(join(here,'..','..','services','lpCleanupRecovery.js'),'utf8');

test('recovery panel offers no force, flat or edit actions',()=>{
 assert.match(service,/cleanupRecoveryActions=\['reconcile_original_ids','observe_original_position','acknowledge','authorize_recovery_round'\]/);
 for(const forbidden of ['force_close','mark_flat','edit_remaining','waive_or_zero','book_customer','release_configuration','resend_same','emergency_override'])assert.doesNotMatch(panel,new RegExp(forbidden,'i'));
 assert.doesNotMatch(panel,/\bflat\b|success/i);
 assert.match(panel,/record\.forbidden_actions\.map/);
});

test('action buttons are gated on server mutations_enabled, actor_can_act and option.permitted',()=>{
 assert.match(panel,/const canAct=Boolean\(record&&record\.mutations_enabled&&record\.actor_can_act\)/);
 assert.match(panel,/\{canAct&&option\.permitted&&<button/);
 assert.match(panel,/\{canAct&&confirming&&<form role="dialog"/);
 assert.match(panel,/<fieldset disabled=\{busy\|\|locked\|\|!canAct\}>/);
 assert.equal((panel.match(/<button/g)||[]).length,4);
});

test('confirmation sends the string plan revision and a required bounded note',()=>{
 assert.match(panel,/expected_plan_revision:record\.plan_revision,note/);
 assert.match(panel,/Expected plan revision: <code>\{record\.plan_revision\}<\/code>/);
 assert.match(panel,/<textarea required aria-label="Recovery note" maxLength=\{CLEANUP_RECOVERY_NOTE_MAX\}/);
 assert.match(panel,/requested, not completed/);
 assert.match(panel,/Evidence resolution required; recovery rounds are not available\./);
 assert.match(panel,/<section className="lp-cleanup-recovery" aria-label="Cleanup recovery">/);
});

test('journal mounts the panel right after LPCleanupRead only for stopped plans',()=>{
 assert.match(journal,/import LPCleanupRecoveryPanel from '\.\/LPCleanupRecoveryPanel\.jsx';/);
 assert.match(journal,/<LPCleanupRead cleanup=\{selected\.cleanup\}\/>\{\['escalated','held','reconcile_required'\]\.includes\(selected\.cleanup\?\.status\)&&<LPCleanupRecoveryPanel key=\{selected\.intent_id\+':'\+selected\.cleanup\.revision\} intentID=\{selected\.intent_id\}\/>\}/);
});
