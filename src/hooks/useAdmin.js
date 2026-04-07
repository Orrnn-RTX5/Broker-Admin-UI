import { useDataFetch } from './useCore';
import { AdminService } from '../services/admin.service';
import { ManagerService } from '../services/manager.service';

export function useStats(enabled = true) {
  return useDataFetch(AdminService.getStats, null, [], enabled);
}

export function useUsers(page = 1, limit = 20, search = '', role = '', enabled = true) {
  return useDataFetch(AdminService.getUsers, { page, limit, search, role }, [page, limit, search, role], enabled);
}
export function useGroups(enabled = true) {
  return useDataFetch(ManagerService.getGroupList, null, [], enabled);
}
