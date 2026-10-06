import { AccountsService } from './accounts.service.js';
import { invalidateDataFetchCaches } from '../hooks/useCore.js';
import { invalidateGroupListCache } from '../utils/groupListCache.js';
export const refreshGroupMembership = result => {
  AccountsService.invalidateCache();
  invalidateGroupListCache({ clearSnapshot: true });
  invalidateDataFetchCaches();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('admin:state-changed'));
    window.dispatchEvent(new CustomEvent('admin:group-membership-changed', { detail: result }));
  }
};
