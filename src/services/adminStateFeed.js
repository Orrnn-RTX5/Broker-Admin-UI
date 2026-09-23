import { api } from '../lib/api.js';
import { buildAdminStateWsUrl } from '../config/endpoints.js';
import { startSessionStateFeed } from './sessionStateFeed.js';

export const startAdminStateFeed = () => startSessionStateFeed({
  requestTicket: async () => (await api.post('/api/v1/manager/ws-ticket',
    { path: '/OnPositionUpdate' }, { timeout: 10000 })).data,
  buildUrl: buildAdminStateWsUrl,
  onChange: () => window.dispatchEvent(new Event('admin:state-changed')),
});
