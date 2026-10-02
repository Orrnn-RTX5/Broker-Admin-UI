import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { fetchServerJournal } from '../services/journal.service.js';
import { takeServerJournalStartup } from '../services/journalStartup.js';
import {
  denyServerJournalAccess, peekServerJournal, readCachedServerJournal, serverJournalDenial,
  subscribeServerJournalCache, warmServerJournalFilters,
} from '../services/serverJournalCache.js';
import {
  SERVER_JOURNAL_FILTERS,
  describeServerJournalError,
  isServerJournalDenied,
  mergeServerJournalPages,
} from '../utils/serverJournal.js';

const emptyState = (key) => ({ key, entries: [], cursor: '', scope: null, error: '', olderError: '', revision: 0, loading: false, loadingOlder: false });
const isCancelled = (error) => error?.code === 'ERR_CANCELED' || error?.name === 'AbortError';
const visible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden';
const pageState = (key, page) => page
  ? { ...emptyState(key), entries: page.data.entries, cursor: page.data.next_cursor, scope: page.data.scope }
  : emptyState(key);

export default function useServerJournal(active, sessionKey = '', displayed = true) {
  const [selection, setSelection] = useState({ owner: sessionKey, filter: 'all' });
  const [liveSelection, setLiveSelection] = useState({ owner: sessionKey, enabled: true });
  const [state, setState] = useState(() => emptyState(''));
  const contextRef = useRef(null);
  const filter = selection.owner === sessionKey ? selection.filter : 'all';
  const key = JSON.stringify([sessionKey, filter]);
  const snapshot = useSyncExternalStore(subscribeServerJournalCache,
    useCallback(() => peekServerJournal(sessionKey, filter), [sessionKey, filter]), () => null);
  const denied = useSyncExternalStore(subscribeServerJournalCache,
    useCallback(() => serverJournalDenial(sessionKey), [sessionKey]), () => null);
  const live = !denied && (liveSelection.owner === sessionKey ? liveSelection.enabled : true);
  // Ownership is checked during rendering, before effects run, so a broker or
  // access change can never briefly display the previous session's rows.
  const current = !active ? emptyState(key)
    : denied ? { ...emptyState(key), error: describeServerJournalError(denied) }
      : state.key === key ? state : pageState(key, snapshot);

  const setLive = useCallback((next) => {
    setLiveSelection((previous) => ({
      owner: sessionKey,
      enabled: typeof next === 'function' ? Boolean(next(previous.owner === sessionKey ? previous.enabled : true)) : Boolean(next),
    }));
  }, [sessionKey]);

  useEffect(() => {
    if (!active || !denied) return undefined;
    const timer = setTimeout(() => setLive(false), 0);
    return () => clearTimeout(timer);
  }, [active, denied, setLive]);

  const refresh = useCallback(async ({ quiet = false, initial = false } = {}) => {
    const context = contextRef.current;
    if (!active || !context || context.key !== key || context.closed) return;
    context.controller?.abort();
    const controller = new AbortController();
    context.controller = controller;
    context.busy = true;
    const sequence = ++context.sequence;
    const relevant = () => contextRef.current === context && !context.closed && context.sequence === sequence;
    setState((previous) => ({
      ...(previous.key === key ? previous : pageState(key, peekServerJournal(sessionKey, filter))),
      loading: !quiet && !peekServerJournal(sessionKey, filter),
      loadingOlder: false,
    }));
    try {
      const startup = context.startupPending && filter === 'all'
        ? takeServerJournalStartup(sessionKey, controller.signal)
        : null;
      context.startupPending = false;
      let data;
      if (startup) {
        try { data = await startup; }
        catch (error) { if (!isCancelled(error) || controller.signal.aborted) throw error; }
      }
      data ||= await readCachedServerJournal(sessionKey, filter, { signal: controller.signal, force: !initial });
      if (!relevant()) return;
      setState((previous) => ({
        ...emptyState(key), entries: data.entries, cursor: data.next_cursor, scope: data.scope,
        revision: (previous.key === key ? previous.revision : 0) + (quiet ? 0 : 1),
      }));
      void warmServerJournalFilters(sessionKey);
    } catch (error) {
      if (!relevant() || isCancelled(error)) return;
      const denied = isServerJournalDenied(error);
      if (denied) { denyServerJournalAccess(sessionKey, error); setLive(false); }
      setState((previous) => ({
        ...(denied || previous.key !== key ? emptyState(key) : previous),
        error: describeServerJournalError(error), loading: false, loadingOlder: false,
      }));
    } finally {
      if (relevant()) {
        context.busy = false;
        context.controller = null;
        setState((previous) => previous.key === key ? { ...previous, loading: false } : previous);
      }
    }
  }, [active, key, filter, sessionKey, setLive]);

  useEffect(() => {
    if (!active) return undefined;
    const context = { key, sequence: 0, closed: false, busy: false, initialPending: true, startupPending: true, controller: null };
    contextRef.current = context;
    const timer = setTimeout(() => { context.initialPending = false; refresh({ initial: true, quiet: Boolean(peekServerJournal(sessionKey, filter)) }); }, 0);
    return () => {
      clearTimeout(timer);
      context.closed = true;
      context.controller?.abort();
      if (contextRef.current === context) contextRef.current = null;
    };
  }, [active, key, refresh, sessionKey, filter]);

  useEffect(() => {
    if (!active || !displayed || !live || denied) return undefined;
    const poll = () => {
      const context = contextRef.current;
      if (visible() && context && !context.initialPending && !context.busy) refresh({ quiet: true });
    };
    // Enabling Live should catch up immediately; the initial fetch is already
    // scheduled by the request-owner effect above.
    poll();
    const timer = setInterval(poll, 5000);
    document.addEventListener('visibilitychange', poll);
    window.addEventListener('focus', poll);
    window.addEventListener('online', poll);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', poll);
      window.removeEventListener('focus', poll);
      window.removeEventListener('online', poll);
    };
  }, [active, displayed, live, denied, refresh]);

  const setFilter = useCallback((next) => {
    if (!SERVER_JOURNAL_FILTERS.some((item) => item.id === next) || next === filter) return;
    // Invalidate immediately; the effect will establish the new request owner.
    const context = contextRef.current;
    if (context) { context.closed = true; context.controller?.abort(); }
    setSelection({ owner: sessionKey, filter: next });
  }, [filter, sessionKey]);

  const loadOlder = useCallback(async () => {
    const context = contextRef.current;
    if (!active || !current.cursor || !context || context.key !== key || context.closed || context.busy) return;
    setLive(false);
    const controller = new AbortController();
    context.controller = controller;
    context.busy = true;
    const sequence = ++context.sequence;
    const relevant = () => contextRef.current === context && !context.closed && context.sequence === sequence;
    setState((previous) => ({ ...previous, olderError: '', loadingOlder: true }));
    try {
      const data = await fetchServerJournal({ filter, cursor: current.cursor }, { signal: controller.signal });
      if (!relevant()) return;
      setState((previous) => ({
        ...previous,
        entries: mergeServerJournalPages(previous.entries, data.entries),
        cursor: data.next_cursor === current.cursor ? '' : data.next_cursor,
        scope: data.scope || previous.scope, error: '', olderError: '', loadingOlder: false,
      }));
    } catch (error) {
      if (!relevant() || isCancelled(error)) return;
      const denied = isServerJournalDenied(error);
      if (denied) { denyServerJournalAccess(sessionKey, error); setLive(false); }
      setState((previous) => ({
        ...(denied ? emptyState(key) : previous),
        ...(denied ? { error: describeServerJournalError(error) } : { olderError: describeServerJournalError(error) }),
        loadingOlder: false,
      }));
    } finally {
      if (relevant()) {
        context.busy = false;
        context.controller = null;
        setState((previous) => previous.key === key ? { ...previous, loadingOlder: false } : previous);
      }
    }
  }, [active, current.cursor, key, filter, sessionKey, setLive]);

  return { ...current, filter, setFilter, live, setLive, refresh, loadOlder };
}
