import { useDataFetch } from './useCore';
import { ServersService } from '../services/servers.service';

export function useServers(enabled = true) {
  return useDataFetch(ServersService.getServers, null, [], enabled);
}
