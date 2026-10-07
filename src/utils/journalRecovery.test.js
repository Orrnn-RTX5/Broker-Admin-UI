import assert from 'node:assert/strict';
import test from 'node:test';
import { createJournalRecovery, isJournalRetryable, journalRequestTimeout, journalRetryAfter } from './journalRecovery.js';

test('temporary failures keep recovering with bounded delays, and successful reads restore normal polling', () => {
  let now = 1000;
  const recovery = createJournalRecovery({ now: () => now });
  assert.equal(recovery.ready(), true);
  for (const delay of [2000, 4000, 8000, 16000, 30000, 30000, 30000]) {
    const failed = recovery.failure({ code: 'ECONNABORTED' });
    assert.equal(failed.retryable, true);
    assert.equal(failed.retryAt - now, delay);
    assert.equal(recovery.ready(), false);
    now = failed.retryAt;
    assert.equal(recovery.ready(), true);
  }
  recovery.success();
  assert.equal(recovery.ready(), false);
  now += 5000;
  assert.equal(recovery.ready(), true);
  assert.equal(recovery.failure({ status: 503 }).retryAt - now, 2000);
});

test('server rate limits are honored; resuming connectivity can wake a recoverable read', () => {
  const recovery = createJournalRecovery({ now: () => 100 });
  assert.equal(recovery.failure({ status: 429, retryAfterMs: 60000 }).retryAt, 60100);
  recovery.wake();
  assert.equal(recovery.ready(), false, 'focus must not bypass a server rate limit');
  recovery.failure({ code: 'ERR_NETWORK' });
  recovery.wake();
  assert.equal(recovery.ready(), true);
});

test('denial, logout, invalid payloads and client errors stop automatic retries even on focus', () => {
  for (const error of [{ status: 401 }, { status: 403 }, { status: 404 }, { code: 'ERR_JOURNAL_RESPONSE' }, { code: 'ERR_CANCELED' }, { name: 'AbortError' }]) {
    const recovery = createJournalRecovery();
    assert.equal(recovery.failure(error).retryable, false);
    recovery.wake();
    assert.equal(recovery.ready(), false);
    recovery.reset();
    assert.equal(recovery.ready(), true);
  }
  assert.equal(isJournalRetryable({ code: 'ERR_NETWORK' }), true);
  assert.equal(isJournalRetryable({ status: 408 }), true);
});

test('timeout configuration stays finite and Retry-After supports both seconds and HTTP dates', () => {
  for (const value of [undefined, '', 0, -1, 'invalid', Infinity, 121000]) assert.equal(journalRequestTimeout(value), 30000);
  assert.equal(journalRequestTimeout('45000'), 45000);
  assert.equal(journalRetryAfter('60'), 60000);
  assert.equal(journalRetryAfter('Thu, 01 Jan 1970 00:01:00 GMT', 1000), 59000);
  assert.equal(journalRetryAfter('invalid'), 0);
});
