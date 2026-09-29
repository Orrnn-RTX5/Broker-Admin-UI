import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = name => readFileSync(join(here, name), 'utf8');
const view = read('DownstreamAccessView.jsx');
const editor = read('DownstreamGrantEditor.jsx');
const card = read('DownstreamCredentialCard.jsx');
const modal = read('DownstreamExportModal.jsx');
const service = readFileSync(join(here, '..', '..', 'services', 'lpDownstream.js'), 'utf8');
const all = [view, editor, card, modal, service];

test('emergency revoke confirms with the exact sentence, needs a reason and the expected revision, and never claims flat', () => {
  assert.match(view, /<p className="lp-downstream-warning">Emergency revoke stops new orders; open trades remain\.<\/p>/);
  assert.match(service, /EMERGENCY_CONFIRM_TEXT = 'Emergency revoke stops new orders; open trades remain\.'/);
  assert.match(view, /aria-label="Emergency revoke reason"/);
  assert.match(view, /disabled=\{busy \|\| Boolean\(reasonProblem\) \|\| !DOWNSTREAM_ROLES\.some/);
  assert.match(view, /api\.emergencyRevoke\(grant\.access_id, role, \{expected_revision: revision, reason\}\)/);
  assert.match(view, /revision = result\.grant\.revision;/);
  assert.match(view, /new orders stopped: \{result\.new_orders_stopped \? 'yes' : 'no'\}/);
  assert.match(view, /Open trades remain: \{result\.open_trades_remain \? 'yes' : 'no'\}/);
  for (const source of [view, card, modal]) assert.doesNotMatch(source, /\bflat\b/i);
  // Offered to Admin regardless of trading: the button is gated only on busy.
  assert.match(view, /<button type="button" className="lp-downstream-danger" disabled=\{busy\} onClick=\{\(\) => \{ setEmergencyResults\(\[\]\); setEmergency\(/);
});

test('the one-time export is never persisted, logged or kept after close', () => {
  for (const source of all) {
    assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|document\.cookie/);
    assert.doesNotMatch(source, /console\.(log|info|debug|warn|error)/);
  }
  assert.match(view, /<DownstreamExportModal value=\{oneTimeExport\} onClose=\{\(\) => setOneTimeExport\(null\)\}\/>/);
  assert.equal((view.match(/setOneTimeExport\(/g) || []).length, 2);
  assert.match(modal, /URL\.revokeObjectURL\(url\)/);
  assert.match(modal, /Close and clear/);
  assert.doesNotMatch(service, /let\s+\w*(export|secret|password)/i);
});

test('the view is broker Admin only and SuperAdmin or managers get no C09 screen', () => {
  assert.match(view, /if \(!isBrokerAdmin\(user\)\) \{/);
  assert.match(view, /Downstream access is managed by the broker Admin only\./);
  assert.match(read('../../utils/permissions.js'), /if \(required === ADMIN_ONLY_VIEW\) return isBrokerAdmin\(user\);/);
});

test('trade-lock refusals show class and reasons, stale writes ask for reload, and badges never claim success', () => {
  assert.match(view, /error\.code === 'DOWNSTREAM_ACCESS_IN_USE'/);
  assert.match(view, /error\.reasons\.map\(inUseReasonLabel\)/);
  assert.match(service, /STALE_REVISION: 'This access changed since it was loaded\. Reload and review before saving\.'/);
  assert.match(view, /const applicationLabel = state => \(state === 'unapplied' \? 'not available' : state\);/);
  for (const source of [view, card, editor]) assert.doesNotMatch(source, /\bsuccess\b|Verification: verified|>\s*verified\s*</i);
  assert.match(card, /Verification: \{verificationLabel/);
});

test('editor offers only supported downstream operations and preselects nothing', () => {
  assert.match(editor, /note="not supported downstream"/);
  assert.match(editor, /Route: B-book \(local\)/);
  assert.match(editor, /const emptyForm = \(\) => \(\{[\s\S]*?symbols: \[\],/);
  assert.match(service, /operations: Object\.freeze\(\['create', 'close', 'partial_close', 'order_status'\]\)/);
  assert.match(service, /policies: Object\.freeze\(\['FOK', 'IOC'\]\)/);
  assert.match(editor, /stale: saved references differ/);
});

test('profile endpoint fields render only for an available profile', () => {
  assert.match(card, /const available = profile\?\.status === 'available';/);
  assert.match(card, /\{available \? \(/);
  assert.match(card, /Connection profile unavailable/);
  assert.match(modal, /profile\?\.status === 'available'/);
});
