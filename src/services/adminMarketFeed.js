import { api } from '../lib/api.js';
import { buildAdminMarketWsUrl } from '../config/endpoints.js';
import { startSessionMarketFeed } from './sessionMarketFeed.js';

export const startAdminMarketFeed = (callbacks) => startSessionMarketFeed({
  ...callbacks,
  requestTicket: async () => {
    const response = await api.post('/api/v1/manager/ws-ticket', { path: '/OnTick' }, { timeout: 10000 });
    return response.data;
  },
  buildUrl: buildAdminMarketWsUrl,
});
