import { fetchServerJournal } from './journal.service.js';
import { peekServerJournal, readCachedServerJournal, warmServerJournalFilters } from './serverJournalCache.js';

export const SERVER_JOURNAL_STARTUP_TTL_MS = 10_000;

// Hold one fresh request while the workspace bundle loads. Ownership transfers
// to the journal hook on consumption; no journal records are persisted.
export const createServerJournalStartup = ({
  fetchJournal = fetchServerJournal,
  now = Date.now,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) => {
  let pending = null;

  const release = (request) => {
    if (pending === request) pending = null;
    clearTimer(request.timer);
  };

  const discard = (sessionKey) => {
    if (!pending || pending.sessionKey !== sessionKey) return;
    const request = pending;
    release(request);
    request.controller.abort();
  };

  const prime = (sessionKey) => {
    if (typeof sessionKey !== 'string' || !sessionKey) return null;
    if (pending?.sessionKey === sessionKey && now() - pending.startedAt < SERVER_JOURNAL_STARTUP_TTL_MS) {
      return pending.promise;
    }
    if (pending) discard(pending.sessionKey);

    const request = { sessionKey, startedAt: now(), controller: new AbortController(), timer: null, promise: null };
    pending = request;
    try {
      request.promise = Promise.resolve(fetchJournal({ filter: 'all' }, { signal: request.controller.signal }));
    } catch (error) {
      request.promise = Promise.reject(error);
    }
    // The workspace may never mount, or the request can fail before it does.
    // Observe that rejection without replacing the promise or hiding its error.
    request.promise.catch(() => {});
    request.timer = setTimer(() => {
      if (pending === request) discard(request.sessionKey);
    }, Math.max(0, SERVER_JOURNAL_STARTUP_TTL_MS - (now() - request.startedAt)));
    return request.promise;
  };

  const take = (sessionKey, signal) => {
    if (!pending || pending.sessionKey !== sessionKey) return null;
    const request = pending;
    if (now() - request.startedAt >= SERVER_JOURNAL_STARTUP_TTL_MS) {
      discard(sessionKey);
      return null;
    }
    release(request);

    const abort = () => request.controller.abort();
    if (signal?.aborted) abort();
    else if (signal) {
      signal.addEventListener('abort', abort, { once: true });
      const cleanup = () => signal.removeEventListener('abort', abort);
      request.promise.then(cleanup, cleanup);
    }
    return request.promise;
  };

  return { prime, discard, take };
};

let startupOwner = '';
const startup = createServerJournalStartup({
  fetchJournal: (options, config) => readCachedServerJournal(startupOwner, options.filter, config),
});
export const primeServerJournalStartup = sessionKey => {
  startupOwner = sessionKey;
  const request = startup.prime(sessionKey);
  // The visible journal and first list pages get the initial connections.
  // Other journal filters can warm after its first response has arrived.
  if (request) request.then(() => {
    if (startupOwner === sessionKey && peekServerJournal(sessionKey, 'all')) return warmServerJournalFilters(sessionKey);
  }).catch(() => {});
  return request;
};
export const discardServerJournalStartup = startup.discard;
export const takeServerJournalStartup = startup.take;
