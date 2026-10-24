// Wiring guard for GroupCreate/GroupUpdate bodies and the duplicate-group per-symbol copy.
// Run with: node --test src/components/RIGHTCLICKJPOPUPS/CreateGroupPopup.source.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const popup = read('./CreateGroupPopup.jsx');
const allocations = read('../organisms/AllocationsView.jsx');
const managerService = read('../../services/manager.service.js');

test('edit sends only the diffed fields (groupUpdateBody); no change makes no call', () => {
  assert.match(popup, /const update = groupUpdateBody\(validated, initialData, changedFields\.current\);/);
  assert.match(popup, /if \(!update\) \{\s*setError\('No changes'\);\s*return;\s*\}/);
  assert.match(popup, /await ManagerService\.updateGroup\(update\);/);
  assert.doesNotMatch(popup, /ManagerService\.updateGroup\(validated\)/);
});

test('create body is built through groupCreateBody with the changed set; nothing else reaches createGroup', () => {
  assert.match(popup, /await ManagerService\.createGroup\(groupCreateBody\(\{ \.\.\.validated, \.\.\.\(routingOverride \? \{ routingMode: routingOverride \} : \{\}\) \}, parentGroup\.trim\(\), changed\)\);/);
  assert.doesNotMatch(popup, /ManagerService\.createGroup\(validated\)/);
});

test('a subgroup duplicate keeps the source routingMode override, and edits diff against the touched fields', () => {
  assert.match(popup, /const routingOverride = duplicateRoutingOverride\(draftData, validated\);/);
  assert.match(popup, /groupCreateBody\(\{ \.\.\.validated, \.\.\.\(routingOverride \? \{ routingMode: routingOverride \} : \{\}\) \}, parentGroup\.trim\(\), changed\)/);
});

test('a subgroup duplicate starts with the source overrides as changed fields (kept, and not overwritten by the parent lookup)', () => {
  assert.match(popup, /useRef\(new Set\(initialData \? \[\] : duplicateOverrideSeed\(draftData\?\.overriddenFields\)\)\)/);
});

test('per-symbol terms are copied only after a successful create; a failed copy is reported and the group is not deleted', () => {
  const createAt = popup.indexOf('await ManagerService.createGroup(');
  const copyAt = popup.indexOf('await copyDuplicateSymbolTerms(');
  assert.ok(createAt > 0 && copyAt > createAt, 'the copy follows the create');
  assert.match(popup, /save: \(group, rows, revision\) => ManagerService\.saveGroupAllowedSymbols\(group, rows, revision\)/);
  assert.match(popup, /read: \(group\) => ManagerService\.getGroupAllowedSymbols\(group\)/);
  assert.match(popup, /group created but per-symbol terms were not copied: \$\{/);
  assert.match(popup, /if \(copied\.status === 'unrestricted'\) termsWarning = 'per-symbol terms were not copied because the new group allows all symbols';/);
  assert.match(popup, /else if \(copied\.unapproved\) termsWarning = `group created; per-symbol terms for \$\{copied\.unapproved\.symbols\.join\(', '\)\} were not approved: \$\{copied\.unapproved\.reason\}`;/);
  // The service omits the key when no valid revision is given (never expected_revision: '' or null).
  assert.match(managerService, /if \(expectedRevision\) body\.expected_revision = expectedRevision;/);
  assert.match(popup, /if \(onCreated\) \{\s*if \(termsWarning\) onCreated\(termsWarning\);/);
  assert.doesNotMatch(popup, /deleteGroup/);
});

test('duplicate reads the source per-symbol terms from GroupSymbolsGet and does not open when that read fails', () => {
  assert.match(allocations, /import \{ ManagerService \} from '\.\.\/\.\.\/services\/manager\.service';/);
  assert.match(allocations, /copySymbolTermsFrom = await ManagerService\.getGroupAllowedSymbols\(group\.name\);/);
  assert.match(allocations, /catch \(error\) \{ setActionError\(getApiErrorMessage\(error, 'The group could not be duplicated\.'\)\); return; \}/);
  assert.match(allocations, /copySymbolTermsFrom=\{groupEditor\.copySymbolTermsFrom\}/);
  assert.match(allocations, /const \{ id: _id, \.\.\.copy \} = record;/);
});
