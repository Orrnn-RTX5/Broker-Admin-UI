import { useDataFetch } from './useCore';
import { AdminService } from '../services/admin.service';
import { ManagerService } from '../services/manager.service';

export function useStats(enabled = true) {
  return useDataFetch(AdminService.getStats, null, [], enabled);
}

export function useUsers(page = 1, limit = 20, search = '', role = '', enabled = true) {
  return useDataFetch(AdminService.getUsers, { page, limit, search, role }, [page, limit, search, role], enabled);
}
export function useGroups(pageOrEnabled = 1, limit = 100, search = '', enabled = true) {
  const legacyEnabledCall = typeof pageOrEnabled === 'boolean';
  const page = legacyEnabledCall ? 1 : pageOrEnabled;
  const isEnabled = legacyEnabledCall ? pageOrEnabled : enabled;

  return useDataFetch(
    ManagerService.getGroupList,
    { page, limit, search },
    [page, limit, search],
    isEnabled
  );
}
