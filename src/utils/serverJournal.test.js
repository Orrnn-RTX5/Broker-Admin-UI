import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SERVER_JOURNAL_FILTERS,
  buildServerJournalQuery,
  describeServerJournalError,
  describeServerJournalScope,
  formatServerJournalTime,
  isServerJournalDenied,
  matchesServerJournalSearch,
  mergeServerJournalPages,
  serverJournalAccessKey,
  serverJournalDetail,
  serverJournalLogin,
  serverJournalSessionKey,
  severityClass,
} from './serverJournal.js';

test('default and preset queries match Manager journal without forcing a broker or account', () => {
  assert.equal(buildServerJournalQuery(), 'limit=50');
  const expected = {
    access: ['access', 'only'], errors: ['severity', 'error'], warnings: ['severity', 'warning'],
    security: ['category', 'SECURITY,AUTH'], trading: ['category', 'TRADE'],
    accounts: ['category', 'ACCOUNT,FINANCE,PARTNER'], config: ['category', 'CONFIG'],
    staff: ['category', 'ADMIN'], system: ['category', 'FEED,SYSTEM,NETWORK,API,NOTIFY'],
  };
  for (const preset of SERVER_JOURNAL_FILTERS.filter((item) => item.id !== 'all')) {
    const params = new URLSearchParams(buildServerJournalQuery({ filter: preset.id }));
    const [key, value] = expected[preset.id];
    assert.equal(params.get(key), value);
    assert.equal(params.get('limit'), '50');
    assert.equal(params.has('broker_id'), false);
    assert.equal(params.has('login'), false);
    assert.equal(params.has('cursor'), false);
  }
});

test('paging encodes opaque cursors without adding query fields', () => {
  const params = new URLSearchParams(buildServerJournalQuery({ filter: 'errors', cursor: 'cursor +/&=next', limit: 50 }));
  assert.equal(params.get('cursor'), 'cursor +/&=next');
  assert.equal(params.get('limit'), '50');
  assert.equal(params.get('severity'), 'error');
  assert.equal(params.size, 3);
});

test('invalid query inputs fail before requesting a broader journal', () => {
  assert.throws(() => buildServerJournalQuery({ filter: 'everything' }), /Invalid journal filter/);
  for (const limit of [0, -1, 1.2, '200', Infinity]) {
    assert.throws(() => buildServerJournalQuery({ limit }), /positive integer/);
  }
  assert.throws(() => buildServerJournalQuery({ cursor: {} }), /cursor must be a string/);
});

test('account login takes precedence and missing or legacy zero account login shows the actor', () => {
  assert.equal(serverJournalLogin({ account_login: 200003, actor_id: '9001' }), 200003);
  assert.equal(serverJournalLogin({ account_login: '200003' }), '200003');
  assert.equal(serverJournalLogin({ account_login: 0, actor_id: '9001' }), '9001');
  assert.equal(serverJournalLogin({ account_login: null, actor_id: '9001' }), '9001');
  assert.equal(serverJournalLogin({}), '—');
});

test('time uses the Manager local timestamp format with millisecond precision', () => {
  const time = new Date(2026, 9, 1, 15, 18, 16, 7).getTime();
  assert.equal(formatServerJournalTime(time), '2026.10.01 15:18:16.007');
  assert.equal(formatServerJournalTime(String(time)), '2026.10.01 15:18:16.007');
  assert.equal(formatServerJournalTime(undefined), '');
  assert.equal(formatServerJournalTime('invalid'), '');
});

test('search is case insensitive and covers account, actor, action, group, result and timestamp', () => {
  const row = {
    time: new Date(2026, 9, 1, 15, 18, 16).getTime(), severity: 'warning', source: 'Terminal',
    category: 'NETWORK', action: 'network', account_login: 200003, actor_id: '9001',
    group: 'Orrnn/demo-standard', result: 'success', message: 'Trading socket connected',
  };
  for (const needle of [' WARNING ', 'terminal', '200003', '9001', 'DEMO-STANDARD', 'socket', 'success', '2026.10.01']) {
    assert.equal(matchesServerJournalSearch(row, needle), true, needle);
  }
  assert.equal(matchesServerJournalSearch(row, 'unrelated'), false);
  assert.equal(matchesServerJournalSearch(row, ''), true);
});

test('older pages keep newest rows and server order while deduplicating both pages', () => {
  const newest = { id: 2, message: 'newest' };
  assert.deepEqual(mergeServerJournalPages([newest, { id: '2' }], [
    { id: '2', message: 'older duplicate' }, { id: '1' }, { id: 1 }, { id: '0' },
  ]), [newest, { id: '1' }, { id: '0' }]);
});

test('scope and severity explain only the access scope supplied by the backend', () => {
  assert.equal(describeServerJournalScope({ mode: 'unrestricted' }), 'Journal · all broker events');
  assert.match(describeServerJournalScope({ mode: 'groups', groups: ['demo'], system: true }), /groups demo.*broker-wide/);
  assert.match(describeServerJournalScope({ mode: 'all_groups' }), /all client groups/);
  assert.match(describeServerJournalScope({ mode: 'own_actions' }), /your own actions only/);
  assert.equal(describeServerJournalScope(null), '');
  assert.equal(severityClass('warning'), 'is-warn');
  assert.equal(severityClass('critical'), 'is-error');
  assert.equal(severityClass('info'), 'is-info');
});

test('permission errors are recognized for normalized and Axios errors', () => {
  assert.equal(isServerJournalDenied({ status: 403 }), true);
  assert.equal(isServerJournalDenied({ response: { status: '403' } }), true);
  assert.equal(isServerJournalDenied({ status: 503 }), false);
  assert.match(describeServerJournalError({ status: 403 }), /View Journal/);
  assert.equal(describeServerJournalError(new Error('Network offline')), 'Journal unavailable — Network offline');
});

test('access key changes on grant, revoke, role, administrator or access revision changes', () => {
  const access = { role: 'Check', permissions: ['credit', 'view_journal'] };
  const key = serverJournalAccessKey(access);
  assert.equal(key, serverJournalAccessKey({ ...access, permissions: ['view_journal', 'credit'] }));
  for (const changed of [
    { ...access, permissions: ['credit'] }, { ...access, permissions: ['credit', 'view_journal', 'view_system'] },
    { ...access, role: 'Dealer' }, { ...access, isAdmin: true }, { ...access, revision: 'groups:demo' },
  ]) assert.notEqual(key, serverJournalAccessKey(changed));
  assert.equal(serverJournalAccessKey(), serverJournalAccessKey({}));
});

test('journal startup ownership changes for every broker, user, permission revision and group scope change', () => {
  const user = {
    broker_id: 'broker-1', login: '9001', role: 'manager', is_admin: false,
    permissions: ['view_journal', 'credit'], authorization_version: 1, access_fingerprint: 'access-1',
    group_access_mode: 'restricted', allowed_groups: ['demo'], groups: ['demo'], group_mask: 'demo',
  };
  const key = serverJournalSessionKey(user);
  for (const changes of [
    { broker_id: 'broker-2' }, { login: '9002' }, { role: 'admin' }, { is_admin: true },
    { permissions: ['credit'] }, { authorization_version: 2 }, { access_fingerprint: 'access-2' },
    { permissions_revision: 2 }, { access_revision: 2 }, { revision: 2 },
    { group_access_mode: 'all_within_broker' }, { allowed_groups: ['real'] }, { groups: ['real'] }, { group_mask: 'real' },
  ]) assert.notEqual(key, serverJournalSessionKey({ ...user, ...changes }), JSON.stringify(changes));
  assert.equal(key, serverJournalSessionKey({ ...user, permissions: ['credit', 'view_journal'], name: 'New display name', accessToken: 'rotated-token' }));
  assert.equal(serverJournalSessionKey({ id: 'fallback' }), serverJournalSessionKey({ login: 'fallback' }));
  assert.equal(serverJournalSessionKey(null), serverJournalSessionKey());
});

test('expanded row includes request context and before/after changes without losing zero or false', () => {
  const detail = serverJournalDetail({
    actor_type: 'admin', actor_id: '9001', actor_ip: '10.0.0.5', result: 'denied', error_code: 'VIEW_JOURNAL',
    target_type: 'account', target_id: 200003, request_id: 'req-1',
    metadata: { method: 'GET', path: '/api/v1/manager/journal', permission: 'view_journal' },
    before: { balance: 0, enabled: false }, after: { balance: 100, enabled: true },
  });
  for (const text of ['By admin 9001', 'IP 10.0.0.5', 'Result denied (VIEW_JOURNAL)', 'Target account 200003',
    'Request req-1', 'GET /api/v1/manager/journal', 'Permission view_journal', 'balance: 0 → 100', 'enabled: false → true']) {
    assert.ok(detail.includes(text), text);
  }
  assert.equal(serverJournalDetail({}), 'No additional details.');
});
