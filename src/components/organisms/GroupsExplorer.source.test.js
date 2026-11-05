// Wiring guard: explorer group lookups compare group names exactly, so a case or space twin is never opened, deleted or listed instead.
// Run with: node --test src/components/organisms/GroupsExplorer.source.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const explorer = readFileSync(new URL('./GroupsExplorer.jsx', import.meta.url), 'utf8');

test('no group-name lookup in the explorer folds case', () => {
  assert.doesNotMatch(explorer, /groupName\.toLowerCase\(\)/);
  assert.doesNotMatch(explorer, /location\.path\.toLowerCase\(\)/);
});

// The behaviour of these lookups is tested on the pure helpers in utils/groupsExplorerData.test.js; this guards the wiring.
// Broad guard: no group-name, path, account-group or record-name value is case-folded anywhere in the component.
test('no group, path, account-group or record name is case-folded in the component', () => {
  assert.doesNotMatch(explorer, /(groupName|path|\.group|\.name|record|Group)[\w.?()\[\]]*\.toLowerCase\(\)/);
});

test('the folder group, the account group and the branch names come from the exact-name helpers', () => {
  assert.match(explorer, /const folderGroupName = explorerFolderGroupName\(groupNodes, location\);/);
  assert.match(explorer, /const resolveAccountGroupNode = \(node\) => resolveExplorerAccountGroup\(groupNodes, node, accountGroupName\);/);
  assert.match(explorer, /const branchNames = \(path\) => explorerBranchNames\(groupNodes, path, SEPARATOR\);/);
});
