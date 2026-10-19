import React, { useState } from 'react';
import { BookOpenCheck, RefreshCw, Save, ShieldAlert } from 'lucide-react';
import { CloseCounterpartsApi, CLOSE_COUNTERPART_PURPOSE_KEYS } from '../../services/closeCounterparts.service';
import { getApiErrorMessage } from '../../utils/apiShapes';
import { hasPermission, PERMISSION_KEYS } from '../../utils/permissions';
import { useAuthStore } from '../../store/authStore';
import ActionableErrorState from '../atoms/ActionableErrorState';

const PURPOSE_LABELS = {
  profit_purpose: 'Profit purpose',
  swap_purpose: 'Swap purpose',
  commission_purpose: 'Commission purpose',
  fee_purpose: 'Fee purpose',
};

const PURPOSE_HINTS = {
  profit_purpose: 'SYSTEM chart account for realized profit on close',
  swap_purpose: 'SYSTEM chart account for swap on close',
  commission_purpose: 'SYSTEM chart account for commission on close',
  fee_purpose: 'SYSTEM chart account for fees on close',
};

const emptyPurposes = () => Object.fromEntries(CLOSE_COUNTERPART_PURPOSE_KEYS.map((key) => [key, '']));

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
};

// ─── Close Counterparts ───────────────────────────────────────────────────────
// Admin-owned view of the mandatory per-legal-entity close-counterpart mapping
// (migration 516). While a legal entity has no enabled mapping, account
// onboarding for it is refused with 422 ACCOUNT_ONBOARDING_CONFIG_MISSING.
// Tenant scope: the backend derives (broker, tenant) from the session, so this
// screen never sends broker_id and only reads/writes the current broker.
const CloseCounterpartsTab = () => {
  const user = useAuthStore((state) => state.user);
  const canConfigure = hasPermission(user, PERMISSION_KEYS.SERVER_ADMIN);
  const sessionTenant = String(user?.broker_id ?? user?.brokerId ?? '').trim() || undefined;

  const [entityInput, setEntityInput] = useState('');
  const [entity, setEntity] = useState('');
  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [purposes, setPurposes] = useState(emptyPurposes);
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [savedAt, setSavedAt] = useState(null);

  const load = async (legalEntity) => {
    const target = String(legalEntity ?? entityInput).trim();
    if (!target) {
      setError('Enter the legal entity whose chart is being configured.');
      return;
    }
    setLoading(true);
    setError('');
    setSaveError('');
    setSavedAt(null);
    try {
      const next = await CloseCounterpartsApi.get(target);
      setEntity(target);
      setRow(next);
      if (next) {
        setPurposes(Object.fromEntries(CLOSE_COUNTERPART_PURPOSE_KEYS.map((key) => [key, next[key] ?? ''])));
        setEnabled(next.enabled !== false);
      } else {
        setPurposes(emptyPurposes());
        setEnabled(true);
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Close-counterpart mapping failed to load.'));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (saving || loading) return;
    if (!entity) {
      setSaveError('Load a legal entity first.');
      return;
    }
    if (!enabled && !window.confirm(
      'Disabling keeps the row and its audit history, but account onboarding for this legal entity will be refused until it is re-enabled. Disable anyway?'
    )) return;
    setSaving(true);
    setSaveError('');
    setSavedAt(null);
    try {
      const { verified } = await CloseCounterpartsApi.save({
        tenantId: sessionTenant,
        legalEntityId: entity,
        purposes,
        enabled,
      });
      setRow(verified);
      setPurposes(Object.fromEntries(CLOSE_COUNTERPART_PURPOSE_KEYS.map((key) => [key, verified[key] ?? ''])));
      setEnabled(verified.enabled !== false);
      setSavedAt(Date.now());
    } catch (err) {
      setSaveError(getApiErrorMessage(err, 'Failed to save the close-counterpart mapping.'));
    } finally {
      setSaving(false);
    }
  };

  const busy = loading || saving;
  const configured = Boolean(row);
  const effectiveEnabled = configured ? row.enabled !== false : enabled;

  return (
    <div className="server-config-scroll">
      <div className="server-config-inner">
        <div className="server-config-section-head">
          <div>
            <div className="server-config-eyebrow">LEDGER CONFIGURATION</div>
            <h2>Close counterparts</h2>
            <p>
              Explicit profit, swap, commission and fee purposes per legal entity.
              Account onboarding is refused until the entity mapping is configured and enabled.
            </p>
          </div>
          <div className="server-config-head-actions">
            <button type="button" className="server-config-button server-config-button-secondary" onClick={() => load()} disabled={busy || !entityInput.trim()}>
              <RefreshCw size={13} className={loading ? 'server-config-spin' : ''} aria-hidden="true" />
              {loading ? 'Loading' : entity ? 'Reload' : 'Load'}
            </button>
          </div>
        </div>

        <section className="server-config-panel-card">
          <div className="server-config-card-head">
            <div className="server-config-card-icon"><BookOpenCheck size={15} aria-hidden="true" /></div>
            <div><h3>Legal entity</h3><p>Each entity has its own chart and its own mapping</p></div>
          </div>
          <div className="server-config-form">
            <label htmlFor="close-counterparts-entity">Legal entity ID <span>*</span></label>
            <input
              id="close-counterparts-entity"
              value={entityInput}
              onChange={(event) => { setEntityInput(event.target.value); setError(''); }}
              onKeyDown={(event) => { if (event.key === 'Enter') load(); }}
              placeholder="Enter the legal entity ID"
              autoComplete="off"
              spellCheck={false}
            />
            <div className="server-config-field-note">
              Only the current broker is read and configured. Purposes are validated against this entity&apos;s active canonical policy chart.
            </div>
          </div>
        </section>

        {error && <ActionableErrorState title="Unable to load mapping" message={error} actionLabel="Retry" onAction={() => load()} />}

        {!entity && !error && (
          <div className="server-config-panel-card">
            <div className="server-config-guidance-row"><strong>Next step</strong><span>Enter a legal entity ID and load its mapping.</span></div>
          </div>
        )}

        {entity && !loading && !error && !configured && (
          <div className="server-config-inline-alert is-warning" role="alert">
            <ShieldAlert size={14} aria-hidden="true" />
            <span>
              No close-counterpart mapping exists for <strong>{entity}</strong>: account onboarding for this
              legal entity is refused with <strong>ACCOUNT_ONBOARDING_CONFIG_MISSING</strong> until one is saved below.
            </span>
          </div>
        )}

        {entity && !loading && !error && configured && (
          <section className="server-config-panel-card">
            <div className="server-config-card-head">
              <div><h3>Configured mapping</h3><p>Validated against the canonical policy chart</p></div>
              <span className={`text-[11px] font-semibold ${row.enabled === false ? 'text-orange-400' : 'text-[#4ec9b0]'}`}>
                {row.enabled === false ? 'Disabled — onboarding refused' : 'Enabled'}
              </span>
            </div>
            <div className="server-config-metric-list">
              {CLOSE_COUNTERPART_PURPOSE_KEYS.map((key) => (
                <div className="server-config-metric-row" key={key}><span>{PURPOSE_LABELS[key]}</span><strong title={row[key]}>{row[key]}</strong></div>
              ))}
              <div className="server-config-metric-row"><span>Policy version</span><strong title={row.policy_version_id}>{row.policy_version_id}</strong></div>
              <div className="server-config-metric-row"><span>Updated by</span><strong>{row.updated_by === 0 ? 'migration/system' : `login ${row.updated_by}`}</strong></div>
              <div className="server-config-metric-row"><span>Updated at</span><strong>{formatDateTime(row.updated_at)}</strong></div>
            </div>
            {!effectiveEnabled && (
              <div className="server-config-field-note">
                The row is kept with its audit history, but consumers treat this entity as unconfigured.
              </div>
            )}
          </section>
        )}

        {entity && !loading && !error && (
          <section className="server-config-panel-card">
            <div className="server-config-card-head">
              <div><h3>{configured ? 'Update mapping' : 'Create mapping'}</h3><p>Every save is audited with the old and new mapping</p></div>
            </div>
            <div className="server-config-form">
              {CLOSE_COUNTERPART_PURPOSE_KEYS.map((key) => (
                <React.Fragment key={key}>
                  <label htmlFor={`close-counterparts-${key}`}>{PURPOSE_LABELS[key]} <span>*</span></label>
                  <input
                    id={`close-counterparts-${key}`}
                    value={purposes[key]}
                    onChange={(event) => { setPurposes((prev) => ({ ...prev, [key]: event.target.value })); setSaveError(''); }}
                    placeholder={`e.g. ${key.replace('_purpose', '').toUpperCase()}`}
                    autoComplete="off"
                    spellCheck={false}
                    disabled={!canConfigure || saving}
                  />
                  <div className="server-config-field-note">{PURPOSE_HINTS[key]}. Printable text without spaces.</div>
                </React.Fragment>
              ))}

              <div className="flex items-center gap-3">
                <span id="close-counterparts-enabled-label" className="text-[11px] text-[color:var(--text-primary)] flex-1">
                  Mapping enabled
                </span>
                <button type="button" role="switch" aria-checked={enabled} aria-labelledby="close-counterparts-enabled-label"
                  onClick={() => setEnabled((prev) => !prev)} disabled={!canConfigure || saving}
                  className={`relative w-[34px] h-[18px] rounded-full border transition-colors disabled:opacity-50 shrink-0 ${enabled ? 'bg-[#4ec9b0]/30 border-[#4ec9b0]/60' : 'bg-[color:var(--bg-surface-2)] border-[#555]'}`}>
                  <span className={`absolute top-[2px] w-[12px] h-[12px] rounded-full transition-all ${enabled ? 'left-[18px] bg-[#4ec9b0]' : 'left-[2px] bg-[#888]'}`} />
                </button>
                <span className={`text-[11px] font-semibold w-[64px] ${enabled ? 'text-[#4ec9b0]' : 'text-orange-400'}`}>
                  {enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>

              {!canConfigure && (
                <div className="server-config-inline-alert is-danger" role="alert">
                  Your session lacks the server_admin grant, so the mapping is read-only.
                </div>
              )}
              {saveError && <div className="server-config-inline-alert is-danger" role="alert">{saveError}</div>}
              {savedAt && row && (
                <div className="server-config-action-result is-good" role="status">
                  <div className="server-config-action-result-title">Saved · {new Date(savedAt).toLocaleTimeString()}</div>
                  <strong>Mapping verified for {entity}</strong>
                  <span>Policy {row.policy_version_id}</span>
                </div>
              )}
              <div className="server-config-control-actions">
                <button type="button" className="server-config-button server-config-button-primary" disabled={!canConfigure || busy} onClick={handleSave}>
                  <Save size={14} aria-hidden="true" />{saving ? 'Saving…' : configured ? 'Save changes' : 'Save mapping'}
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default CloseCounterpartsTab;
