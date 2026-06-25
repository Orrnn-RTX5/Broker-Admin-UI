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
  assert.match(src, /response:\s*accountsResponse/);
  assert.match(src, /keys:\s*\['accounts', 'data', 'answer', 'items', 'rows'\]/);
  assert.match(src, /mapFn:\s*getBrokerClientRow/);
});
