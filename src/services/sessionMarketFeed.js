// The existing admin session obtains a single-use WebSocket ticket internally.
// No FIX password, broker token, or long-lived session is sent in the WS URL.
export const extractMarketTicks = (raw) => {
  const ticks = [];
  for (const line of String(raw || '').split('\n')) {
    if (!line.trim()) continue;
    try {
      const payload = JSON.parse(line);
      const rows = Array.isArray(payload) ? payload : [payload];
      for (const row of rows) {
        const tick = row?.data || row;
        if (tick?.symbol && Number.isFinite(Number(tick.bid)) && Number.isFinite(Number(tick.ask))
          && Number(tick.bid) > 0 && Number(tick.ask) > 0) ticks.push(tick);
      }
    } catch { /* Ignore control frames and malformed messages. */ }
  }
  return ticks;
};

export const startSessionMarketFeed = ({
  requestTicket, buildUrl, onTicks, onState = () => {},
  createSocket = (url) => new WebSocket(url),
  retryMs = 5000, connectTimeoutMs = 10000, staleTimeoutMs = 30000,
}) => {
  let stopped = false;
  let socket = null;
  let retryTimer = null;
  let watchdog = null;
  let staleTimer = null;
  let receiving = false;
  const awaitTicks = () => {
    clearTimeout(staleTimer);
    staleTimer = setTimeout(() => {
      if (!stopped && socket) {
        receiving = false;
        onState('stale');
      }
    }, staleTimeoutMs);
  };
  const retry = () => {
    clearTimeout(watchdog);
    if (!stopped && !retryTimer) retryTimer = setTimeout(() => {
      retryTimer = null;
      connect();
    }, retryMs);
  };
  const connect = async () => {
    if (stopped) return;
    onState('connecting');
    try {
      const response = await requestTicket();
      if (stopped) return;
      const ticket = response?.ticket || response?.data?.ticket || response?.answer?.ticket;
      if (!ticket) throw new Error('Live market authorization unavailable.');
      const current = createSocket(buildUrl(ticket));
      socket = current;
      watchdog = setTimeout(() => current.close(), connectTimeoutMs);
      current.onopen = () => {
        if (stopped || socket !== current) return;
        clearTimeout(watchdog);
        onState('connected');
        receiving = true;
        awaitTicks();
        // OnTick streams automatically; it does not use /ws/feed subscriptions.
      };
      current.onmessage = (event) => {
        if (stopped || socket !== current) return;
        const ticks = extractMarketTicks(event.data);
        if (ticks.length) {
          if (!receiving) onState('connected');
          receiving = true;
          awaitTicks();
          onTicks(ticks);
        }
      };
      current.onerror = () => current.close();
      current.onclose = () => {
        if (stopped || socket !== current) return;
        socket = null;
        clearTimeout(staleTimer);
        receiving = false;
        onState('disconnected');
        retry();
      };
    } catch {
      if (!stopped) {
        onState('unavailable');
        retry();
      }
    }
  };
  connect();
  return () => {
    stopped = true;
    clearTimeout(retryTimer);
    clearTimeout(watchdog);
    clearTimeout(staleTimer);
    if (socket) socket.close();
    socket = null;
  };
};
