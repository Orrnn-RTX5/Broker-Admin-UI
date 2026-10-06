// Source-level regression guard for the Group properties dialog.
// Run with: node --test src/components/RIGHTCLICKJPOPUPS/GroupPropertiesPopup.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, 'GroupPropertiesPopup.jsx'), 'utf8');
const serviceSrc = readFileSync(join(here, '..', '..', 'services', 'manager.service.js'), 'utf8');

test('Margin: OK sends only the changed margin fields to GroupUpdate', () => {
  assert.match(src, /const \{ changes, errors \} = buildMarginChanges\(initialMargin, marginForm\);/);
  assert.match(src, /await ManagerService\.updateGroup\(withExpectedRevision\(\{ originalName: currentGroupName, \.\.\.marginChanges \}, groupRevision\)\);/);
  assert.match(src, /describeAccountsUpdated\(res\)/, 'toast reports accounts_updated');
  assert.doesNotMatch(src, /buildGroupRiskPayload/, 'the whole-form payload (with symbol arrays) is no longer sent');
  assert.doesNotMatch(src, /symbolsAllowed|symbolsBlocked/);
  assert.match(src, /checked=\{marginForm\.negativeBalanceProtection\}/);
  assert.match(src, /label="Execution mode"/);
  assert.doesNotMatch(src, /label="Risk management"/);
});

test('Symbol List: staged legacy list loads from GroupSymbolsGet and saves via GroupSymbolsSave on OK', () => {
  assert.match(src, /ManagerService\.getGroupAllowedSymbols\(currentGroupName\)/);
  assert.match(src, /await ManagerService\.saveGroupAllowedSymbols\(payload\.group, payload\.symbols, symbolsRevision\);/);
  assert.match(src, /isGroupSymbolListDirty\(symbolsBaseline, symbolRows\)/);
  assert.match(src, /accounts in this group see all symbols available from its quote feed/);
  assert.match(src, /ManagerService\.getGroupFeedSymbols\(groupName\)/);
  assert.match(src, /findGroupFeedSymbol\(symbols, name\)/);
  assert.match(serviceSrc, /api\.get\('\/manager\/SymbolList', \{ params: \{ group, catalog: 1 \} \}\)/);
  assert.match(src, /Saving a non-empty list restricts this group to exactly the listed symbols/, 'legacy list warns that it restricts');
  assert.doesNotMatch(src, /getSymbolSet\(/, 'ADD no longer upserts immediately via the legacy GET');
  assert.doesNotMatch(src, /SymbolPropertiesPopup/, 'rows no longer open the nested symbol popup');
  assert.match(serviceSrc, /api\.get\('\/manager\/GroupSymbolsGet', \{ params: \{ group: groupName \} \}\)/);
  assert.match(serviceSrc, /const body = \{ group: groupName, symbols \};\s*if \(expectedRevision\) body\.expected_revision = expectedRevision;\s*const res = await api\.post\('\/manager\/GroupSymbolsSave', body\);/);
});

test('Symbols: global symbols with group overrides; saving never sends the symbol list', () => {
  assert.match(src, /ManagerService\.getGroupSymbolOverrides\(currentGroupName\)/);
  assert.match(src, /const changes = buildGroupSymbolOverrideChanges\(stagedOverrides\);/);
  assert.match(src, /await ManagerService\.saveGroupSymbolOverrides\(currentGroupName, changes\);/);
  assert.match(src, /disabled=\{!editable\}/, 'rows blocked above the group cannot be toggled');
  assert.ok(
    src.indexOf('saveGroupAllowedSymbols(') < src.indexOf('saveGroupSymbolOverrides(currentGroupName'),
    'the symbol list saves before overrides so overrides win'
  );
  assert.match(src, /Trading is switched off for this group/);
  assert.match(src, /if \(tab === 'Symbols' && !overridesView && !overridesLoading\) loadOverrides\(\);/);
  assert.match(src, /if \(tab === 'Symbol List' && !symbolsLoaded && !symbolsLoading\) loadSymbols\(\);/);
  assert.match(serviceSrc, /api\.get\('\/manager\/GroupSymbolOverridesGet', \{ params: \{ group: groupName \} \}\)/);
  assert.match(serviceSrc, /api\.post\('\/manager\/GroupSymbolOverridesSave', \{ group: groupName, changes \}\)/);
});

test('Commissions: scoped to the group, editable, no alert()', () => {
  assert.match(src, /ManagerService\.getCommissionScheduleList\(currentGroupName\)/);
  assert.match(src, /ManagerService\.updateCommissionSchedule\(withExpectedRevision\(payload, commissionEditor\.revision\)\)/);
  assert.match(src, /ManagerService\.deleteCommissionSchedule\(getScheduleId\(row\), readRevision\(row\)\)/);
  assert.match(src, /buildCommissionSchedulePayload\(commissionEditor\.form, currentGroupName/);
  assert.doesNotMatch(src, /\balert\(/);
  assert.doesNotMatch(src, /EURUSD Standard/, 'no hardcoded create-form defaults');
  assert.match(serviceSrc, /api\.post\('\/manager\/CommissionScheduleUpdate', data\)/);
  assert.match(serviceSrc, /const body = \{ schedule_id: Number\(scheduleId\) \};\s*if \(expectedRevision\) body\.expected_revision = expectedRevision;\s*const res = await api\.post\('\/manager\/CommissionScheduleDelete', body\);/);
  assert.match(serviceSrc, /params: cleanParams\(\{ group \}\)/);
});

test('Dialog chrome: Help works, dead tabs and window buttons are gone', () => {
  assert.match(src, /const TABS = \['Accounts', 'Margin', 'Symbols', 'Commissions', 'Inheritance', 'Migration'\];/);
  assert.match(src, /onClick=\{\(\) => setShowHelp\(\(value\) => !value\)\}/);
  for (const dead of ["'Statistics'", "'Company'", "'Reports'", "'News & Mail'", "'Permissions'", "'Common'"]) {
    assert.equal(src.includes(`activeTab === ${dead}`), false, `unreachable tab body ${dead} removed`);
  }
  assert.doesNotMatch(src, /getGroupStats/);
  assert.doesNotMatch(src, /\bMinus\b|\bSquare\b/, 'minimize/maximize buttons removed');
});

test('GroupPropertiesPopup opens on an Accounts tab that lists every account of the group', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(here, 'GroupPropertiesPopup.jsx'), 'utf8');
  const tab = readFileSync(join(here, 'GroupAccountsTab.jsx'), 'utf8');

  assert.match(src, /initialTab = 'Accounts',/);
  assert.match(src, /const TABS = \['Accounts', 'Margin', 'Symbols', 'Commissions', 'Inheritance', 'Migration'\];/);
  assert.match(src, /<GroupAccountsTab groupName=\{currentGroupName\} onOpenAccount=\{onOpenAccount\} \/>/);
  assert.match(tab, /loadGroupsExplorerNodes\(\s*\{ type: 'group', groupName \}/, 'accounts come from the paged, exact-group loader');
});

test("Double-clicking an account opens its group's Margin / Symbols / Commissions window with live data", () => {
  const explorer = readFileSync(join(here, '..', 'organisms', 'GroupsExplorer.jsx'), 'utf8');
  const app = readFileSync(join(here, '..', '..', 'AuthenticatedApp.jsx'), 'utf8');

  assert.match(explorer, /if \(node\.type === 'group-account'\) openAccountGroup\(node\);/);
  assert.match(explorer, /onSelect=\{\(\) => onAccountOpen\?\.\(node\)\}>Open account</, 'the account editor stays on the context menu');
  assert.match(app, /onAccountGroupOpen=\{openAccountGroupProperties\}/);
  assert.match(app, /initialTab=\{groupPopupFromAccount \? 'Margin' : \(selectedGroup\?\.initialTab \|\| 'Accounts'\)\}/);
  assert.match(app, /showAccountsTab=\{!groupPopupFromAccount\}/);
  assert.match(src, /const tabs = showAccountsTab \? TABS : TABS\.filter\(\(tab\) => tab !== 'Accounts'\);/);
  assert.match(src, /loadGroupTreePages\(ManagerService\.getGroupList, \{ arrayKeys: GROUP_LIST_ARRAY_KEYS \}\)/, 'margin values are reloaded from the server');
  assert.match(src, /findGroupRecord\(rows, currentGroupName\)/);
});
