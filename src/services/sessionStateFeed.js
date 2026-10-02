// One session-scoped stream invalidates authorized REST projections. The
// payload is a change hint, never a replacement for an account snapshot.
export function startSessionStateFeed({ requestTicket, buildUrl, onChange,
  createSocket = (url) => new WebSocket(url), retryMs = 1000 }) {
  let stopped = false, socket = null, retry, deadline, refresh, generation = 0;
  const invalidate = () => {
    if (stopped || refresh) return;
    refresh = setTimeout(() => { refresh = undefined; if (!stopped) onChange(); }, 50);
  };
  const reconnect = (attempt) => {
    if (stopped || attempt !== generation) return;
    generation += 1;
    clearTimeout(deadline);
    const obsolete = socket;
    socket = null;
    if (obsolete) obsolete.close();
    if (!stopped && !retry) retry = setTimeout(() => { retry = undefined; void connect(); }, retryMs);
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
      const current = createSocket(buildUrl(ticket));
      socket = current;
      current.onopen = () => { if (!stopped && attempt === generation && socket === current) { clearTimeout(deadline); invalidate(); } };
      current.onmessage = ({ data: raw }) => {
        if (stopped || socket !== current) return;
        try {
          const event = JSON.parse(raw);
          if (event.type === 'state_changed' || event.type === 'access_changed' || event.action || event.data?.action) invalidate();
        } catch { /* malformed/control frames cannot change local state */ }
      };
      current.onerror = () => reconnect(attempt);
      current.onclose = () => reconnect(attempt);
    } catch { reconnect(attempt); }
  };
  void connect();
  return () => {
    stopped = true;
    clearTimeout(retry); clearTimeout(deadline); clearTimeout(refresh);
    if (socket) socket.close();
  };
}
