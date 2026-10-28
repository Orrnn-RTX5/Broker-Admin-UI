import {readCalculationRefusal} from './calculationBaseline.js';

// Automatic baseline bootstrap, contract v1: pure request builders and
// response readers for the auto-bootstrap manager routes. No I/O here.
export const AUTO_BOOTSTRAP_RUN_TIMEOUT_MS = 75000;
const ATTESTATION_LIMIT = 2000;
const ATTESTATIONS = [['execution','Execution policy'],['risk','Risk policy'],['fx','FX conversion policy']];
const COUNTERPARTS = ['profit','swap','commission','fee'];
const BUSY_CODE = 'AUTO_BOOTSTRAP_BUSY';
const BUSY_TEXT = 'A bootstrap run is already in progress.';
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const trimmed = value => typeof value === 'string' ? value.trim() : '';
const textOr = (value, fallback = '') => typeof value === 'string' ? value : fallback;
const refusalText = value => {
 const text = typeof value === 'string' ? value.trim() : '';
 return text && !text.startsWith('<') ? text.slice(0, 300) : '';
};
const findings = (list, kind) => {
 if (list === null || list === undefined) return [];
 if (!Array.isArray(list)) throw new Error(`The bootstrap run has no readable ${kind} list.`);
 return list.map(item => {
  if (!isObject(item) || typeof item.code !== 'string' || typeof item.message !== 'string') throw new Error(`A bootstrap run ${kind.slice(0, -1)} is unreadable.`);
  return {code: item.code, subject: textOr(item.subject), message: item.message};
 });
};

// Checks the GET config body and keeps every field, so a PUT can send the
// fields the card does not edit unchanged.
export function readAutoBootstrapConfig(value) {
 const unreadable = () => new Error('The automatic bootstrap settings are unreadable.');
 if (!isObject(value) || typeof value.configured !== 'boolean' || typeof value.enabled !== 'boolean' || typeof value.accept_group_commissions !== 'boolean' || typeof value.zero_commission_reason !== 'string' || typeof value.open_commission_counterpart !== 'string' || !isObject(value.attestation) || !isObject(value.close_counterparts)) throw unreadable();
 const attestation = {}, close = {};
 for (const [key] of ATTESTATIONS) {
  if (typeof value.attestation[key] !== 'string') throw unreadable();
  attestation[key] = value.attestation[key];
 }
 for (const key of COUNTERPARTS) {
  if (typeof value.close_counterparts[key] !== 'string') throw unreadable();
  close[key] = value.close_counterparts[key];
 }
 if (value.symbol_groups !== null && (!Array.isArray(value.symbol_groups) || value.symbol_groups.some(name => typeof name !== 'string'))) throw unreadable();
 if (value.updated_at !== undefined && value.updated_at !== null && typeof value.updated_at !== 'string') throw unreadable();
 return {
  broker_id: textOr(value.broker_id),
  configured: value.configured,
  enabled: value.enabled,
  attestation,
  accept_group_commissions: value.accept_group_commissions,
  zero_commission_reason: value.zero_commission_reason,
  symbol_groups: value.symbol_groups === null ? null : [...value.symbol_groups],
  close_counterparts: close,
  open_commission_counterpart: value.open_commission_counterpart,
  updated_by: textOr(value.updated_by),
  updated_at: typeof value.updated_at === 'string' ? value.updated_at : null,
 };
}

// The PUT is an all-fields replace. The toggle and the three attestation texts
// come from the form; every other field is copied from the last GET.
export function buildAutoBootstrapPut(config, form) {
 const source = readAutoBootstrapConfig(config);
 const attestation = Object.fromEntries(ATTESTATIONS.map(([key]) => [key, trimmed(form?.[key])]));
 for (const [key, label] of ATTESTATIONS) {
  if (attestation[key].length > ATTESTATION_LIMIT) throw new Error(`The ${label} attestation must be at most ${ATTESTATION_LIMIT} characters.`);
 }
 const enabled = form?.enabled === true;
 const missing = ATTESTATIONS.filter(([key]) => !attestation[key]).map(([, label]) => label);
 if (enabled && missing.length) throw new Error(`Enter the ${missing.join(', ')} attestation before enabling automatic bootstrap.`);
 return {
  enabled,
  attestation,
  accept_group_commissions: source.accept_group_commissions,
  zero_commission_reason: source.zero_commission_reason,
  symbol_groups: source.symbol_groups,
  close_counterparts: source.close_counterparts,
  open_commission_counterpart: source.open_commission_counterpart,
 };
}

// A run result. The outcome is passed through even when this build does not
// know it, so a newer backend outcome is shown rather than dropped.
export function readAutoBootstrapRun(value) {
 if (!isObject(value) || typeof value.outcome !== 'string' || !value.outcome) throw new Error('The bootstrap run response is unreadable.');
 const stepsSource = value.steps ?? {};
 if (!isObject(stepsSource)) throw new Error('The bootstrap run steps are unreadable.');
 const steps = {};
 for (const [key, state] of Object.entries(stepsSource)) steps[key] = String(state);
 return {
  outcome: value.outcome,
  reason: textOr(value.reason),
  blockers: findings(value.blockers, 'blockers'),
  warnings: findings(value.warnings, 'warnings'),
  steps,
  draftHash: textOr(value.draft_hash),
  fingerprint: textOr(value.fingerprint),
  startedAt: typeof value.started_at === 'string' ? value.started_at : null,
  finishedAt: typeof value.finished_at === 'string' ? value.finished_at : null,
 };
}

export function readAutoBootstrapStatus(value) {
 if (!isObject(value) || typeof value.running !== 'boolean' || typeof value.lineage !== 'string') throw new Error('The automatic bootstrap status is unreadable.');
 return {
  running: value.running,
  lastRun: value.last_run === null || value.last_run === undefined ? null : readAutoBootstrapRun(value.last_run),
  nextAttemptAt: typeof value.next_attempt_at === 'string' ? value.next_attempt_at : null,
  lineage: value.lineage,
  healthReason: textOr(value.health_reason),
 };
}

// A refused request. A 403 keeps the server's authority reason; a 404 means
// the route is missing on this server, whatever its body says.
export function readAutoBootstrapRefusal(response) {
 const status = Number(response?.status) || 0;
 if (status === 403) return readCalculationRefusal(response);
 if (status === 404) return 'Auto-bootstrap is not available on this server yet (HTTP 404).';
 if (status === 413) return 'The automatic bootstrap request is larger than the 64 KiB limit (HTTP 413).';
 if (status === 503) return 'The automatic bootstrap service is unavailable (HTTP 503). Try again shortly.';
 const data = response?.data;
 const message = typeof data === 'string' ? refusalText(data) : refusalText(data?.message);
 const code = isObject(data) ? refusalText(data.error) || refusalText(data.error_code) || refusalText(data.code) : '';
 if (status === 409 && (code === BUSY_CODE || !code)) return BUSY_TEXT;
 if (status === 400) {
  const field = isObject(data) ? refusalText(data.field) : '';
  const reason = message || 'The automatic bootstrap settings are invalid.';
  return field && !reason.includes(field) ? `${field}: ${reason}` : reason;
 }
 const tags = [code, status ? `HTTP ${status}` : 'HTTP error'].filter(tag => tag && !message.includes(tag));
 if (!message) return `The automatic bootstrap request was not confirmed (${tags.join(', ')}).`;
 return `${message.replace(/[\s.]+$/, '')} (${tags.join(', ')}).`;
}

// One line for a run. Blockers are listed separately by the card.
export function describeAutoBootstrapRun(run) {
 const when = run.finishedAt || run.startedAt || '';
 const at = when ? ` at ${when}` : '';
 const reason = run.reason ? ` (reason: ${run.reason})` : '';
 switch (run.outcome) {
  case 'activated': return `Activated${at}${run.draftHash ? `, draft ${run.draftHash}` : ''}${reason}`;
  case 'already_active': return `Already active${at}: an existing lineage is in place and nothing was changed${reason}`;
  case 'blocked': return `Blocked${at}: ${run.blockers.length} blocker${run.blockers.length === 1 ? '' : 's'} must be resolved${reason}`;
  case 'skipped': return `Skipped${at}${reason}`;
  case 'failed': return `Failed${at}${reason}`;
  default: return `Outcome "${run.outcome}"${at}${reason}`;
 }
}
