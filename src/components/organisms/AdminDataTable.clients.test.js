import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./AdminDataTable.jsx', import.meta.url), 'utf8');

test('Clients view uses broker account details instead of admin users endpoint', () => {
  assert.doesNotMatch(src, /import\s+\{\s*useUsers/);
  assert.match(src, /const usesAccountDetailsMany = viewType === 'Clients' \|\| viewType === 'Trading Accounts'/);
  assert.match(src, /useAccounts\(activePage,\s*pageSize,\s*debouncedSearchQuery,\s*'',\s*'',\s*usesAccountDetailsMany\)/);
  assert.match(src, /'Clients':\s*refetchAccounts/);
  assert.match(src, /'Clients':\s*accountsError/);
});

test('Clients rows are derived from AccountDetailsMany response fields', () => {
  assert.match(src, /const getBrokerClientRow = \(account, idx\) => \{/);
  assert.match(src, /pickDefined\(account, \['id', 'ID', 'login', 'Login', 'account_login', 'accountLogin', 'email', 'Email', 'phone', 'Phone'\], idx\)/);
  assert.match(src, /raw:\s*account/);
  assert.match(src, /response:\s*accountsResponse/);
  assert.match(src, /keys:\s*\['accounts', 'data', 'answer', 'items', 'rows'\]/);
  assert.match(src, /mapFn:\s*getBrokerClientRow/);
});

test('Clients and Trading Accounts preserve selected account rows for edit actions', () => {
  assert.match(src, /const ACCOUNT_EDIT_VIEW_TYPES = new Set\(\['Clients', 'Trading Accounts'\]\)/);
  assert.match(src, /onEditableTargetSelect/);
  assert.match(src, /selectedEditableTargetId/);
  assert.match(src, /if \(isAccountEditView\) return 'account';/);
  assert.match(src, /type: targetType, row, viewType, id: row\.id/);
  assert.match(src, /onClick=\{\(\) => handleRowClick\(row\)\}/);
});

test('Groups and group lookup tabs preserve selected rows for the previous group edit action', () => {
  assert.match(src, /const isGroupEditView = viewType === 'Groups' \|\| isGroupLookupView;/);
  assert.match(src, /if \(isGroupEditView && row\.iconType === 'group'\) return 'group';/);
  assert.match(src, /selectedEditableTargetType === getRowEditTargetType\(row\)/);
});
