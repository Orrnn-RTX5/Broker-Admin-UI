export const extractMarketTicks = (raw) => {
  const ticks = [];
  const visit = value => {
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (!value || typeof value !== 'object') return;
    if (typeof value.symbol === 'string' && value.symbol.trim() && (value.bid !== undefined || value.ask !== undefined)) {
      ticks.push(value);
      return;
    }
    for (const key of ['ticks', 'data', 'quotes', 'symbols']) if (Array.isArray(value[key])) value[key].forEach(visit);
  };
  if (typeof raw !== 'string') { visit(raw); return ticks; }
  try { visit(JSON.parse(raw)); } catch {
    for (const line of raw.split('\n')) {
      try { visit(JSON.parse(line)); } catch { /* Ignore non-quote messages. */ }
    }
  }
  return ticks;
};

export const validMarketPrice = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) && Number(value) > 0;
export const formatMarketPrice = value => validMarketPrice(value) ? Number(value).toFixed(5) : '—';
export const isMarketQuoteFresh = (quote, connected, now = Date.now()) => Boolean(connected && quote?.live && quote.lastUpdate && now - quote.lastUpdate < 30000);
