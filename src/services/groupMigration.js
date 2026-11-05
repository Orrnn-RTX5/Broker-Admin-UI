import { api } from '../lib/api.js';
// Mutations use the backend's POST+JSON successor; the legacy mutating GET of these routes answers 410 Gone.
const fetchManagerApi = async (endpoint, init = {}) => { try { const result = init.method === 'POST' ? await api.post('/manager' + endpoint, init.body, { _noRetry: true, ...(init.timeout ? { timeout: init.timeout } : {}) }) : await api.get('/manager' + endpoint, { _noRetry: true }); return { ok: result.status >= 200 && result.status < 300, status: result.status, json: async () => result.data }; } catch (error) { if (!error.response) throw error; return { ok: false, status: error.response.status, json: async () => error.response.data }; } };

const names = (from, to) => {
  if (typeof from !== 'string' || !from.trim() || typeof to !== 'string' || !to.trim() || from === to) throw new Error('Choose different saved source and destination groups.');
  return { from_group: from, to_group: to };
};

export const migrationIsVerified = (result, source, destination) => result?.status === 'verified' && result?.history_verified === true && typeof result?.migration_id === 'string' && result.migration_id.length > 0 && (!source || result.from_group === source) && (!destination || result.to_group === destination);

// The move is one POST. The backend bounds its own work (an engine freeze of up to 100 s, a COMMIT of up to 15 s, Retry-After
// of 120 s), so the client waits 150 s. A client-side timeout ends the wait, not the server's work: the outcome is unknown.
export const MIGRATE_TIMEOUT_MS = 150000;

export function createGroupMigration(request = fetchManagerApi) {
  const call = async (endpoint, init = {}) => {
    const response = await request(endpoint, { cache: 'no-store', headers: { accept: 'application/json' }, ...init });
    const value = await response.json();
    if (!response.ok || value?.exception || value?.error || value?.success === false) {
      const error = new Error(value?.message || value?.exception?.message || value?.error?.message || (typeof value?.error === 'string' ? value.error : value?.blockers?.length ? value.blockers.join('; ') : 'Group migration request failed.'));
      error.details = value; error.status = response.status; error.code = value?.error_code || value?.code; throw error;
    }
    return value;
  };
  return {
    preview: (from, to) => call(`/GroupMigrationPreview?${new URLSearchParams(names(from, to))}`),
    migrate: (from, to) => call('/GroupMoveAccounts', { method: 'POST', body: names(from, to), timeout: MIGRATE_TIMEOUT_MS }),
    // A-R6-6: the delete needs the typed line DELETE <group> (byte-exact). Without it no request is sent.
    remove: (name, confirmation) => {
      if (confirmation !== `DELETE ${String(name ?? '')}`) throw new Error('Group deletion needs the typed confirmation line DELETE <group>.');
      return call('/GroupDelete', { method: 'POST', body: { group: name } });
    },
    // All-login member count of a group (GroupStats accountCount). A read: no timeout, no retry, the caller shows the failure.
    destinationCount: name => call(`/GroupStats?${new URLSearchParams({ group: name })}`),
  };
}
export const groupMigration = createGroupMigration();
