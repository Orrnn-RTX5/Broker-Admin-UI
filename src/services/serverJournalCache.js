import { fetchServerJournal } from './journal.service.js';
import { SERVER_JOURNAL_FILTERS } from '../utils/serverJournal.js';
import { isJournalRetryable } from '../utils/journalRecovery.js';

export const SERVER_JOURNAL_FRESH_MS = 5_000;
export const SERVER_JOURNAL_WARM_MS = 60_000;
const filterOrder = [...new Set(['errors', 'warnings', 'security', 'trading',
  ...SERVER_JOURNAL_FILTERS.map(item => item.id).filter(id => id !== 'all')])];
const cancelled = () => Object.assign(new Error('Journal request canceled'), { name: 'AbortError', code: 'ERR_CANCELED' });

// A view can stop waiting without canceling a shared background request.
const waitFor = (promise, signal) => {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(cancelled());
  return new Promise((resolve, reject) => {
    const abort = () => { signal.removeEventListener('abort', abort); reject(cancelled()); };
    signal.addEventListener('abort', abort, { once: true });
    promise.then(value => { signal.removeEventListener('abort', abort); resolve(value); },
      error => { signal.removeEventListener('abort', abort); reject(error); });
  });
};

// Only authorized first pages are retained, in memory, for one session/scope.
// A document reload, sign-out, broker switch or access change starts fresh.
export const createServerJournalCache = ({ fetchJournal = fetchServerJournal, now = Date.now } = {}) => {
  let owner = '', generation = 0, denial = null, warming = null, prefetchPausedUntil = 0;
  const pages = new Map(), pending = new Map(), failures = new Map(), listeners = new Set();
  const notify = () => { for (const listener of listeners) listener(); };
  const reset = (nextOwner = '') => {
    generation++;
    owner = nextOwner;
    denial = null;
    prefetchPausedUntil = 0;
    pages.clear(); failures.clear();
    for (const request of pending.values()) request.controller.abort();
    pending.clear(); warming = null;
    notify();
  };
  const prepare = sessionKey => {
    if (!sessionKey) throw new Error('Journal session is required');
    if (owner !== sessionKey) reset(sessionKey);
  };
  const peek = (sessionKey, filter) => owner === sessionKey ? pages.get(filter) || null : null;
  const getDenial = sessionKey => owner === sessionKey ? denial : null;
  const rejectAccess = (sessionKey, error) => {
    if (owner !== sessionKey) return;
    generation++;
    pages.clear(); denial = error;
    for (const request of pending.values()) request.controller.abort();
    pending.clear(); warming = null;
    notify();
  };
  const pauseWarming = (sessionKey, duration = SERVER_JOURNAL_WARM_MS) => {
    if (owner !== sessionKey) return;
    prefetchPausedUntil = Math.max(prefetchPausedUntil, now() + duration);
    for (const [filter, request] of pending) {
      if (!request.background) continue;
      pending.delete(filter);
      request.controller.abort();
    }
  };
  const read = (sessionKey, filter = 'all', { signal, force = false, background = false } = {}) => {
    if (signal?.aborted) return Promise.reject(cancelled());
    prepare(sessionKey);
    if (denial && !force) return Promise.reject(denial);
    const page = pages.get(filter);
    if (!force && page && now() - page.fetchedAt < SERVER_JOURNAL_FRESH_MS) return waitFor(Promise.resolve(page.data), signal);
    if (pending.has(filter)) {
      const request = pending.get(filter);
      if (!background) request.background = false;
      return waitFor(request.promise, signal);
    }
    const request = { controller: new AbortController(), generation, promise: null, background };
    const relevant = () => owner === sessionKey && generation === request.generation;
    pending.set(filter, request);
    request.promise = (async () => {
      try {
        const data = await fetchJournal({ filter }, { signal: request.controller.signal });
        if (!relevant() || request.controller.signal.aborted) throw cancelled();
        pages.set(filter, { data, fetchedAt: now() });
        failures.delete(filter);
        denial = null;
        notify();
        return data;
      } catch (error) {
        if (relevant() && error?.code !== 'ERR_CANCELED' && error?.name !== 'AbortError') {
          failures.set(filter, now());
          if (isJournalRetryable(error)) pauseWarming(sessionKey);
          if (Number(error?.status ?? error?.response?.status) === 403) {
            // Clear every filter immediately, including other views whose
            // previously authorized records were already in memory.
            rejectAccess(sessionKey, error);
          }
        }
        throw error;
      } finally {
        if (pending.get(filter) === request) pending.delete(filter);
      }
    })();
    // A prefetch may finish before a view attaches a consumer.
    request.promise.catch(() => {});
    return waitFor(request.promise, signal);
  };
  const warm = sessionKey => {
    prepare(sessionKey);
    if (denial || warming || now() < prefetchPausedUntil) return warming || Promise.resolve();
    const queue = filterOrder.filter(filter => {
      const page = pages.get(filter), failedAt = failures.get(filter);
      return (!page || now() - page.fetchedAt >= SERVER_JOURNAL_WARM_MS)
        && (failedAt === undefined || now() - failedAt >= SERVER_JOURNAL_WARM_MS);
    });
    if (!queue.length) return Promise.resolve();
    const token = generation;
    const worker = async () => {
      while (queue.length && owner === sessionKey && generation === token && !denial && now() >= prefetchPausedUntil) {
        const filter = queue.shift();
        try { await read(sessionKey, filter, { background: true }); } catch { /* selected views surface their own errors */ }
      }
    };
    // Background work is bounded; selecting a queued filter can read it
    // immediately and selecting an in-flight filter shares that request.
    const task = Promise.allSettled([worker(), worker()]);
    warming = task;
    task.finally(() => { if (warming === task) warming = null; });
    return task;
  };
  return { read, peek, warm, pauseWarming, getDenial, rejectAccess, clear: () => reset(),
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); } };
};

const cache = createServerJournalCache();
export const readCachedServerJournal = cache.read;
export const peekServerJournal = cache.peek;
export const warmServerJournalFilters = cache.warm;
export const pauseServerJournalWarming = cache.pauseWarming;
export const serverJournalDenial = cache.getDenial;
export const denyServerJournalAccess = cache.rejectAccess;
export const clearServerJournalCache = cache.clear;
export const subscribeServerJournalCache = cache.subscribe;
