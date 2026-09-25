import { useCallback, useEffect, useState } from 'react';
import { InstrumentsService } from '../services/instruments.service';
import { invalidateLpSymbols, loadLpSymbols } from '../utils/lpSymbols';

/**
 * All LP symbols merged with the configured instruments (see utils/lpSymbols).
 * Returns { symbols, names, loading, error, reload }; `symbols` entries are
 * { symbol, configured, instrument, category, fromLp }.
 */
export const useLpSymbols = () => {
  const [symbols, setSymbols] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      setSymbols(await loadLpSymbols(InstrumentsService, { force }));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const reload = useCallback(() => {
    invalidateLpSymbols();
    return load(true);
  }, [load]);

  return { symbols, names: symbols.map((entry) => entry.symbol), loading, error, reload };
};
