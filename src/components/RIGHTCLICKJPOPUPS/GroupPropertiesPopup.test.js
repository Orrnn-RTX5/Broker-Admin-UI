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

test('Symbols: staged list loads from GroupSymbolsGet and saves via GroupSymbolsSave on OK', () => {
  assert.match(src, /ManagerService\.getGroupAllowedSymbols\(currentGroupName\)/);
  assert.match(src, /await ManagerService\.saveGroupAllowedSymbols\(payload\.group, payload\.symbols, symbolsRevision\);/);
  assert.match(src, /isGroupSymbolListDirty\(symbolsBaseline, symbolRows\)/);
  assert.match(src, /accounts in this group see all symbols available from its quote feed/);
  assert.match(src, /ManagerService\.getGroupFeedSymbols\(groupName\)/);
  assert.match(src, /findGroupFeedSymbol\(symbols, name\)/);
  assert.match(serviceSrc, /api\.get\('\/manager\/SymbolList', \{ params: \{ group, catalog: 1 \} \}\)/);
  assert.doesNotMatch(src, /getSymbolSet\(/, 'ADD no longer upserts immediately via the legacy GET');
  assert.doesNotMatch(src, /SymbolPropertiesPopup/, 'rows no longer open the nested symbol popup');
  assert.match(serviceSrc, /api\.get\('\/manager\/GroupSymbolsGet', \{ params: \{ group: groupName \} \}\)/);
  assert.match(serviceSrc, /const body = \{ group: groupName, symbols \};\s*if \(expectedRevision\) body\.expected_revision = expectedRevision;\s*const res = await api\.post\('\/manager\/GroupSymbolsSave', body\);/);
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
  assert.match(src, /const TABS = \['Margin', 'Symbols', 'Commissions', 'Inheritance', 'Migration'\];/);
  assert.match(src, /onClick=\{\(\) => setShowHelp\(\(value\) => !value\)\}/);
  for (const dead of ["'Statistics'", "'Company'", "'Reports'", "'News & Mail'", "'Permissions'", "'Common'"]) {
    assert.equal(src.includes(`activeTab === ${dead}`), false, `unreachable tab body ${dead} removed`);
  }
  assert.doesNotMatch(src, /getGroupStats/);
  assert.doesNotMatch(src, /\bMinus\b|\bSquare\b/, 'minimize/maximize buttons removed');
});
