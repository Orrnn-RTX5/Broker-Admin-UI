import { useDataFetch } from './useCore';
import { ManagerService } from '../services/manager.service';

export function useDynamicLeverages(enabled = true) {
  const fetcher = async () => {
    const rawData = await ManagerService.getDynamicLeverageList();
    // Support parsing out array if it returns wrapped
    if (Array.isArray(rawData)) return rawData;
    if (rawData && Array.isArray(rawData.data)) return rawData.data;
    if (rawData && Array.isArray(rawData.leverages)) return rawData.leverages;
    return rawData;
  };
  return useDataFetch(fetcher, null, [], enabled);
}
