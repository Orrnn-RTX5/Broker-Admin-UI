import { useDataFetch } from './useCore';
import { ManagerService } from '../services/manager.service';

export function useRoles(enabled = true) {
  return useDataFetch(ManagerService.getRoleList, null, [], enabled);
}
