import { useDataFetch } from './useCore';
import { InstrumentsService } from '../services/instruments.service';

export function useInstruments(page = 1, limit = 50, search = '', filterEnabled = '', enabled = true) {
  const result = useDataFetch(
    InstrumentsService.getInstruments,
    { page, limit, search, enabled: filterEnabled },
    [page, limit, search, filterEnabled],
    enabled,
    { requestKey: 'manager:instruments', cacheTtlMs: 30000, keepPreviousData: true }
  );
  return { ...result, loading: result.loading && result.data === null };
}
