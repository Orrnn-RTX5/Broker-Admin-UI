import { useDataFetch } from './useCore';
import { ManagerService } from '../services/manager.service';

export function useHolidays(enabled = true) {
  const fetcher = async () => {
    const rawData = await ManagerService.getHolidayList();
    if (Array.isArray(rawData)) return rawData;
    if (rawData && Array.isArray(rawData.data)) return rawData.data;
    if (rawData && Array.isArray(rawData.holidays)) return rawData.holidays;
    return rawData;
  };
  return useDataFetch(fetcher, null, [], enabled);
}
