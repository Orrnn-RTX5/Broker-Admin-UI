import { useDataFetch } from './useCore';
import { AccountsService } from '../services/accounts.service';

export function useAccounts(page = 1, limit = 20, search = '', group = '', status = '', enabled = true) {
  return useDataFetch(
    AccountsService.getAccounts,
    { page, limit, search, group, status },
    [page, limit, search, group, status],
    enabled,
    { requestKey: 'manager:accounts' }
  );
}

export function useAccountDetail(login, enabled = true) {
  return useDataFetch(
    AccountsService.getAccount,
    login,
    [login],
    enabled,
    { requestKey: 'manager:account-detail' }
  );
}
