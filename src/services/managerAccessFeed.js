import { api } from '../lib/api.js';
import { buildManagerApiUrl } from '../config/endpoints.js';
import { startSessionStateFeed } from './sessionStateFeed.js';

const path = '/api/v1/manager/access/events';

export const startManagerAccessFeed = onChange => startSessionStateFeed({
  requestTicket: async () => (await api.post('/manager/api/v1/manager/ws-ticket', { path }, { timeout: 10000 })).data,
  buildUrl: ticket => {
    const url = new URL(buildManagerApiUrl(path), window.location.href);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.searchParams.set('ticket', ticket);
    return url.toString();
  },
  onChange,
});
