// One session-scoped stream invalidates authorized REST projections. The
// payload is a change hint, never a replacement for an account snapshot.
export const SESSION_STATE_MAX_RETRY_MS = 30000;

export function nextSessionStateRetryMs({
  attempt = 0, baseMs = 1000, maxMs = SESSION_STATE_MAX_RETRY_MS,
  jitterRatio = 0.25, random = Math.random,
} = {}) {
  const exponent = Math.min(Math.max(0, Number(attempt) || 0), 10);
  const cappedBase = Math.min(Math.max(0, Number(baseMs) || 0), Math.max(0, Number(maxMs) || 0));
  const exponential = Math.min(Math.max(0, Number(maxMs) || 0), cappedBase * (2 ** exponent));
  const jitter = Math.round(exponential * Math.max(0, jitterRatio));
  const varied = exponential - jitter + Math.round((Number(random()) || 0) * jitter * 2);
  return Math.min(Math.max(0, Number(maxMs) || 0), Math.max(0, varied));
}

export function startSessionStateFeed({ requestTicket, buildUrl, onChange,
  createSocket = (url) => new WebSocket(url), retryMs = 1000,
  maxRetryMs = SESSION_STATE_MAX_RETRY_MS, random = Math.random,
  stableMs = 10000 }) {
  let stopped = false, socket = null, retry, deadline, refresh, stableTimer, generation = 0, retryAttempt = 0;
  const retireSocket = current => {
    if (!current) return;
    current.onmessage = null;
    current.onerror = null;
    current.onclose = null;
    if (current.readyState === 0) {
      // Closing during a handshake creates a browser error even on normal
      // cleanup. Obsolete sockets cannot publish and close as soon as opened.
      current.onopen = () => current.close();
    } else {
      current.onopen = null;
      if (current.readyState !== 2 && current.readyState !== 3) current.close();
    }
  };
  const invalidate = () => {
    if (stopped || refresh) return;
    refresh = setTimeout(() => { refresh = undefined; if (!stopped) onChange(); }, 50);
  };
  const reconnect = (attempt) => {
    if (stopped || attempt !== generation) return;
    generation += 1;
    clearTimeout(deadline);
    clearTimeout(stableTimer);
    stableTimer = undefined;
    const obsolete = socket;
    socket = null;
    retireSocket(obsolete);
    if (!stopped && !retry) {
      const delayMs = nextSessionStateRetryMs({ attempt: retryAttempt, baseMs: retryMs, maxMs: maxRetryMs, random });
      retryAttempt += 1;
      retry = setTimeout(() => { retry = undefined; void connect(); }, delayMs);
    }
  };
  const connect = async () => {
    if (stopped) return;
    const attempt = ++generation;
    // Bound ticket acquisition too; a hung request must not kill recovery.
    deadline = setTimeout(() => reconnect(attempt), 10000);
    try {
      const data = await requestTicket();
      if (stopped || attempt !== generation) return;
      const ticket = data?.ticket || data?.data?.ticket || data?.answer?.ticket;
      if (!ticket) throw new Error('State stream ticket unavailable');
      clearTimeout(deadline);
      const current = createSocket(buildUrl(ticket));
      socket = current;
      // Ticket acquisition and the socket handshake each get their own bound.
      deadline = setTimeout(() => reconnect(attempt), 10000);
      current.onopen = () => {
        if (stopped || attempt !== generation || socket !== current) return;
        clearTimeout(deadline);
        // Reset the backoff only after a connection proves stable. A server
        // that upgrades then immediately drops (or sends one seed frame) must
        // not reset the loop to the base delay.
        clearTimeout(stableTimer);
        stableTimer = setTimeout(() => {
          if (!stopped && attempt === generation && socket === current) retryAttempt = 0;
        }, Math.max(0, Number(stableMs) || 0));
        invalidate();
      };
      current.onmessage = ({ data: raw }) => {
        if (stopped || socket !== current) return;
        try {
          const event = JSON.parse(raw);
          if (event.type === 'state_changed' || event.type === 'access_changed' || event.action || event.data?.action) {
            invalidate();
          }
        } catch { /* malformed/control frames cannot change local state */ }
      };
      current.onerror = () => reconnect(attempt);
      current.onclose = () => reconnect(attempt);
    } catch { reconnect(attempt); }
  };
  void connect();
  return () => {
    stopped = true;
    generation += 1;
    clearTimeout(retry); clearTimeout(deadline); clearTimeout(refresh); clearTimeout(stableTimer);
    const obsolete = socket;
    socket = null;
    retireSocket(obsolete);
  };
}
