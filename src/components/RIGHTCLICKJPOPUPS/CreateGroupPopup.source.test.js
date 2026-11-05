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
  assert.match(popup, /await ManagerService\.createGroup\(groupCreateBody\(\{ \.\.\.validated, \.\.\.\(routingOverride \? \{ routingMode: routingOverride \} : \{\}\) \}, exactParentGroup\(parentGroup\), changed\)\);/);
  assert.doesNotMatch(popup, /ManagerService\.createGroup\(validated\)/);
});

test('a subgroup duplicate keeps the source routingMode override, and edits diff against the touched fields', () => {
  assert.match(popup, /const routingOverride = duplicateRoutingOverride\(draftData, validated\);/);
  assert.match(popup, /groupCreateBody\(\{ \.\.\.validated, \.\.\.\(routingOverride \? \{ routingMode: routingOverride \} : \{\}\) \}, exactParentGroup\(parentGroup\), changed\)/);
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

test('a new group is checked for case and space twins against the loaded group list before the request', () => {
  assert.match(popup, /loadGroupList\(\(\) => loadGroupTreePages\(ManagerService\.getGroupList, \{ arrayKeys: GROUP_LIST_ARRAY_KEYS \}\), \{ force: groupListAttempt > 0 \}\)/);
  assert.match(popup, /if \(initialData\) return;\s*let disposed = false;\s*setGroupListStatus\('loading'\);\s*loadGroupList/);
  assert.match(popup, /validateGroupSection\(formData, activeSection, existingGroupNames, initialData \? null : parentState\);/);
  assert.match(popup, /paddedNewNameRefusal\(formData\.name\)/, 'a padded new name is refused on the General step');
  assert.match(popup, /\? validateGroupForm\(formData, existingGroupNames\)/);
});

test('a server GROUP_NAME_CASE_CONFLICT is shown with the client wording on the name field, not as a trading or risk error', () => {
  // The mapping itself is behaviour-tested on groupCreateConflictFromError (groupFormSteps.test.js); this checks it is wired.
  assert.match(popup, /const conflict = leverageMessage \? null : groupCreateConflictFromError\(err\);/);
  assert.match(popup, /conflict\?\.existing \? groupNameCaseConflictMessage\(conflict\.existing\) : getApiErrorMessage\(err, 'Error creating group'\)/);
  assert.match(popup, /if \(conflict\) \{ setActiveSection\('details'\); setErrorField\('name'\); \}\s*else if \(\/commission/);
});

test('the create guard runs before any request: the form and parent rules, then the name probe; a refusal stops the create', () => {
  // The decision is behaviour-tested on createGuardRefusal (groupFormSteps.test.js). This checks the popup runs it before createGroup and stops on a refusal.
  const guardAt = popup.indexOf('await createGuardRefusal({');
  const createAt = popup.indexOf('await ManagerService.createGroup(');
  assert.ok(guardAt > 0 && createAt > guardAt, 'the guard runs before the create');
  assert.match(popup, /probe: \(\) => ManagerService\.getGroupNameAvailability\(formData\.name\.trim\(\)\)/);
  assert.match(popup, /if \(refusal\) \{ showValidation\(refusal\); return; \}/);
  assert.match(managerService, /getGroupNameAvailability: async \(groupName\) => \{[\s\S]*?_isolatedConnectionStatus: true,/);
});

test('the parent field is named for focus and shows the list state, with a Retry while the list has failed', () => {
  assert.match(popup, /<input name="parentGroup" aria-label="New group parent"/);
  assert.match(popup, /groupListStatus === 'failed' && <> <button type="button" className="ui-btn ui-btn-secondary" disabled=\{isLoading\} onClick=\{retryGroupList\}>Retry<\/button>/);
});

test('the parent is looked up and created with its exact name; a lookup fills the form only from that exact record', () => {
  assert.match(popup, /ManagerService\.getGroup\(exactParentGroup\(parentGroup\)\)\.then\(fresh => \{ if \(!disposed && parentRecordMatches\(fresh, parentGroup\)\) setFormData/);
  assert.match(popup, /exactParentGroup\(parentGroup\), changed\)\);/);
  assert.doesNotMatch(popup, /parentGroup\.trim\(\)/, 'no trimmed parent reaches the lookup or the create');
});


// T6-3 (wiring): the parent field's pending flag comes from parentLookupPending, so a padded entry never holds the submit (A-R5-11).
test('T6-3: the parent field sets its pending flag from parentLookupPending, and a padded new name is refused on the General step', () => {
  assert.match(popup, /setParentLoading\(parentLookupPending\(event\.target\.value\)\)/);
  assert.match(popup, /parentLookupPending,/);
  assert.match(popup, /paddedNewNameRefusal,/);
});
