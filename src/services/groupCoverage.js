import { api } from '../lib/api.js';
const defaultRequest = async (path, options) => { try { const response = await api.request({ url: path, method: options.method, data: options.body ? JSON.parse(options.body) : undefined, _noRetry: true }); return { ok: true, json: async () => response.data }; } catch (error) { if (!error.response) throw error; return { ok: false, json: async () => error.response.data }; } };

const base = '/api/v1/manager/lp-routing/group-coverage';
const groupPath = group => {
  if (typeof group !== 'string' || !group.trim() || group !== group.trim() || group.length > 100 || /[\r\n\0]/.test(group)) throw new Error('Enter a saved client group name.');
  return `${base}/${encodeURIComponent(group)}`;
};
const accountPath = account => {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(account)) throw new Error('Enter the coverage account UUID.');
  return encodeURIComponent(account);
};
export const coverageAssignmentPayload = (revision, kind, connection) => {
  if (typeof revision !== 'string' || !/^(0|[1-9][0-9]*)$/.test(revision) || BigInt(revision) >= 9223372036854775807n) throw new Error('Reload the coverage assignment before saving.');
  if (!['internal', 'external'].includes(kind)) throw new Error('Choose an internal or external destination.');
  if (kind === 'external' && !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(connection)) throw new Error('Choose the external LP connection.');
  if (kind === 'internal' && connection) throw new Error('Internal coverage does not use an external LP connection.');
  return { expected_revision: revision, destination_kind: kind, connection_id: connection };
};
export function createGroupCoverage(request = defaultRequest) {
  const call = async (path, body) => {
    const response = await request(path, { method: body ? 'PUT' : 'GET', headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const value = await response.json();
    if (!response.ok) {
      const messages = { LP_PERMISSION_DENIED: 'Permission for the client group, coverage account and its group, and required connections is needed.', LP_COVERAGE_ASSIGNMENT_CONFLICT: 'The assignment changed or this coverage account is assigned to another client group. Reload before saving.', LP_COVERAGE_ACCOUNT_UNAVAILABLE: 'The coverage account is unavailable.', LP_INVALID_REQUEST: 'Choose a valid coverage destination.' };
      throw new Error(messages[value?.error_code] || 'The coverage assignment request failed.');
    }
    return value;
  };
  return { list: group => call(groupPath(group)), get: (group, account) => call(`${groupPath(group)}/${accountPath(account)}`),
    save: (group, account, revision, kind, connection) => call(`${groupPath(group)}/${accountPath(account)}`, coverageAssignmentPayload(revision, kind, connection)) };
}
export const groupCoverage = createGroupCoverage();
