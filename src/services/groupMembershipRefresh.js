import { AccountsService } from './accounts.service.js';
import { invalidateDataFetchCaches } from '../hooks/useCore.js';
export const refreshGroupMembership = result => {
  AccountsService.invalidateCache();
  invalidateDataFetchCaches();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('admin:state-changed'));
    window.dispatchEvent(new CustomEvent('admin:group-membership-changed', { detail: result }));
  }
};
