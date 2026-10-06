import { api } from '../lib/api.js';
const fetchManagerApi = async endpoint => { try { const result = await api.get('/manager' + endpoint, { _noRetry: true }); return { ok: result.status >= 200 && result.status < 300, json: async () => result.data }; } catch (error) { if (!error.response) throw error; return { ok: false, json: async () => error.response.data }; } };

const names = (from, to) => {
  if (typeof from !== 'string' || !from.trim() || typeof to !== 'string' || !to.trim() || from === to) throw new Error('Choose different saved source and destination groups.');
  return new URLSearchParams({ from_group: from, to_group: to });
};

export const migrationIsVerified = (result, source, destination) => result?.status === 'verified' && result?.history_verified === true && typeof result?.migration_id === 'string' && result.migration_id.length > 0 && (!source || result.from_group === source) && (!destination || result.to_group === destination);

export function createGroupMigration(request = fetchManagerApi) {
  const call = async endpoint => {
    const response = await request(endpoint, { cache: 'no-store', headers: { accept: 'application/json' } });
    const value = await response.json();
    if (!response.ok || value?.exception || value?.error || value?.success === false) {
      const error = new Error(value?.message || value?.exception?.message || value?.error?.message || (typeof value?.error === 'string' ? value.error : value?.blockers?.length ? value.blockers.join('; ') : 'Group migration request failed.'));
      error.details = value; error.status = response.status; error.code = value?.error_code || value?.code; throw error;
    }
    return value;
  };
  return {
    preview: (from, to) => call(`/GroupMigrationPreview?${names(from, to)}`),
    migrate: (from, to) => call(`/GroupMoveAccounts?${names(from, to)}`),
    remove: name => call(`/GroupDelete?${new URLSearchParams({ group: name })}`),
  };
}
export const groupMigration = createGroupMigration();
