// Source-level regression guard for admin-ui-R01.
// Run with: node --test src/components/RIGHTCLICKJPOPUPS/GroupPropertiesPopup.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

test('GroupPropertiesPopup renders exactly one nested SymbolPropertiesPopup with group context', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(here, 'GroupPropertiesPopup.jsx'), 'utf8');
  const renderCount = (src.match(/<SymbolPropertiesPopup\b/g) || []).length;

  assert.equal(renderCount, 1, 'selectedSymbol must mount one SymbolPropertiesPopup, not two overlapping modals');
  assert.match(src, /groupName=\{currentGroupName\}/, 'nested symbol popup must receive current group context');
});

test('GroupPropertiesPopup saves supported group fields through ManagerService.updateGroup', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(here, 'GroupPropertiesPopup.jsx'), 'utf8');

  assert.match(src, /import \{ buildGroupRiskPayload \} from '\.\.\/\.\.\/utils\/adminValidation';/);
  assert.match(src, /const \[formData, setFormData\] = useState\(\(\) => buildInitialGroupForm\(group\)\);/);
  assert.match(src, /const payload = buildGroupRiskPayload\(formData\);/);
  assert.match(src, /await ManagerService\.updateGroup\(payload\);/);
  assert.match(src, /onClick=\{handleSaveGroup\}/);
  assert.match(src, /setSaveError\(error\?\.response\?\.data\?\.message \|\| error\?\.message \|\| 'Failed to update group\.'\);/);
});
