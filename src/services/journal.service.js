import { api } from '../lib/api.js';
import { buildServerJournalQuery, mergeServerJournalPages } from '../utils/serverJournal.js';

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const responseMessage = (payload) => {
  if (typeof payload === 'string') return payload;
  for (const value of [payload?.message, payload?.detail, payload?.error?.message, payload?.error]) {
    if (typeof value === 'string' && value.trim()) return value;
  }
  return '';
};

const journalError = (message, status) => {
  const error = new Error(message);
  if (status) error.status = Number(status);
  return error;
};

export const validateServerJournalResponse = (payload) => {
  const message = responseMessage(payload);
  const status = [payload?.status, payload?.status_code, payload?.error?.status]
    .map(Number).find((value) => Number.isInteger(value) && value >= 400 && value <= 599);
  const denied = /\b(permission denied|forbidden|no journal access)\b/i.test(message);
  const rejected = payload?.success === false || Boolean(payload?.error)
    || payload?.status === 'error' || status >= 400 || denied;
  if (rejected) throw journalError(message || 'Journal request failed.', denied ? 403 : status);
  if (!isRecord(payload) || !Array.isArray(payload.entries)) {
    throw journalError(message || 'Invalid journal response: expected an entries array.');
  }
  if (payload.entries.some((entry) => !isRecord(entry)
    || !['string', 'number'].includes(typeof entry.id) || String(entry.id).trim() === ''
    || (typeof entry.id === 'number' && !Number.isFinite(entry.id))
    || !Number.isFinite(Number(entry.time)) || Number(entry.time) <= 0
    || Number.isNaN(new Date(Number(entry.time)).getTime()))) {
    throw journalError('Invalid journal response: each entry requires a valid event ID and timestamp.');
  }
  const textFields = ['severity', 'source', 'category', 'action', 'group', 'message', 'result'];
  const identityFields = ['account_login', 'actor_id'];
  if (payload.entries.some((entry) => textFields.some((field) => entry[field] != null && typeof entry[field] !== 'string')
    || identityFields.some((field) => entry[field] != null && !['string', 'number'].includes(typeof entry[field])))) {
    throw journalError('Invalid journal response: journal columns must contain text or account identifiers.');
  }
  if (payload.next_cursor != null && typeof payload.next_cursor !== 'string') {
    throw journalError('Invalid journal response: next_cursor must be a string.');
  }
  if (payload.scope != null && (!isRecord(payload.scope)
    || (payload.scope.mode !== undefined && typeof payload.scope.mode !== 'string')
    || (payload.scope.system !== undefined && typeof payload.scope.system !== 'boolean')
    || (payload.scope.groups !== undefined && (!Array.isArray(payload.scope.groups)
      || payload.scope.groups.some((group) => typeof group !== 'string'))))) {
    throw journalError('Invalid journal response: scope must describe the permitted journal groups.');
  }
  return {
    ...payload,
    entries: mergeServerJournalPages([], payload.entries),
    next_cursor: payload.next_cursor || '',
    scope: payload.scope || null,
  };
};

// Broker identity and Bearer authentication come from the existing API client.
// This native versioned path must bypass legacy /manager URL rewriting.
export const fetchServerJournal = async (options = {}, config = {}) => {
  const query = buildServerJournalQuery(options);
  try {
    const response = await api.get(`/api/v1/manager/journal?${query}`, {
      timeout: 15000,
      ...config,
      _nativeBrokerApi: true,
    });
    return validateServerJournalResponse(response.data);
  } catch (error) {
    if (error?.code === 'ERR_CANCELED' || error?.name === 'AbortError') throw error;
    const status = error?.status ?? error?.response?.status;
    throw journalError(responseMessage(error?.response?.data) || error?.message || 'Journal request failed.', status);
  }
};
