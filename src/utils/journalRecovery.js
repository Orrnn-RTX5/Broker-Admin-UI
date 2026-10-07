export const JOURNAL_POLL_MS = 5_000;
export const JOURNAL_REQUEST_TIMEOUT_MS = 30_000;
export const journalRequestTimeout = value => {
  const timeout = Number(value);
  return Number.isFinite(timeout) && timeout >= 1_000 && timeout <= 120_000 ? timeout : JOURNAL_REQUEST_TIMEOUT_MS;
};

export const isJournalRetryable = error => {
  if (error?.code === 'ERR_CANCELED' || error?.name === 'AbortError') return false;
  const status = Number(error?.status ?? error?.response?.status);
  if (status) return status === 408 || status === 429 || status >= 500;
  return ['ERR_NETWORK', 'ECONNABORTED', 'ETIMEDOUT', 'ERR_CONNECTION_RESET'].includes(error?.code);
};

export const journalRetryAfter = (value, now = Date.now()) => {
  if (!value) return 0;
  const seconds = Number(value);
  const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - now;
  return Number.isFinite(delay) ? Math.max(0, delay) : 0;
};

// One recovery clock per authorized view. A failed read does not end Live,
// but permission, authentication and invalid-response errors are not retried.
export const createJournalRecovery = ({ now = Date.now } = {}) => {
  let failures = 0, nextAttemptAt = 0, notBefore = 0, stopped = false;
  return {
    ready: () => !stopped && now() >= nextAttemptAt,
    reset: () => { failures = 0; nextAttemptAt = 0; notBefore = 0; stopped = false; },
    wake: () => { if (!stopped) nextAttemptAt = Math.max(now(), notBefore); },
    success: () => { failures = 0; stopped = false; notBefore = 0; nextAttemptAt = now() + JOURNAL_POLL_MS; },
    failure: error => {
      stopped = !isJournalRetryable(error);
      failures++;
      notBefore = now() + (error?.retryAfterMs || 0);
      const delay = Math.max(Math.min(2_000 * 2 ** Math.min(failures - 1, 4), 30_000), error?.retryAfterMs || 0);
      nextAttemptAt = stopped ? Infinity : now() + delay;
      return { retryable: !stopped, retryAt: stopped ? 0 : nextAttemptAt };
    },
  };
};
