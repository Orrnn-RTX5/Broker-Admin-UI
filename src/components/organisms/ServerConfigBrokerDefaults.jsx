import React, { useState, useEffect } from 'react';
import { RefreshCw, Save } from 'lucide-react';
import { BrokerGroupDefaultsApi } from '../../services/brokerGroupDefaults.service';
import { getApiErrorMessage } from '../../utils/apiShapes';
import { hasPermission, PERMISSION_KEYS } from '../../utils/permissions';
import { useAuthStore } from '../../store/authStore';
import ActionableErrorState from '../atoms/ActionableErrorState';
import {
  GROUP_LEVERAGE_MAX,
  GROUP_LEVERAGE_MIN,
  formatGroupDefaultLeverage,
  parseGroupLeverage,
} from '../../utils/brokerGroupDefaults';

const toInput = (value) => (value == null ? '' : String(value));

// ─── Broker Defaults ──────────────────────────────────────────────────────────
// Broker-wide defaults applied to newly created groups. The backend derives the
// broker from the session (no broker_id is sent). Blank clears the default.
const BrokerDefaultsTab = () => {
  const user = useAuthStore((state) => state.user);
  const canConfigure = hasPermission(user, PERMISSION_KEYS.SERVER_ADMIN);
  const [state, setState] = useState(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);

  const apply = (next) => { setState(next); setInput(toInput(next.defaultLeverage)); };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      apply(await BrokerGroupDefaultsApi.get());
    } catch (err) {
      setError(getApiErrorMessage(err, 'Broker defaults failed to load.'));
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps -- load once on mount; Refresh reloads.

  const handleSave = async () => {
    const parsed = parseGroupLeverage(input, 'Default leverage');
    if (parsed.error) { setFieldError(parsed.error); return; }
    setSaving(true);
    setSaveError('');
    setSaved(false);
    try {
      // save() PUTs { group_default_leverage: int | null } and re-reads the stored value.
      apply(await BrokerGroupDefaultsApi.save(parsed.value));
      setSaved(true);
    } catch (err) {
      if (err?.code === 'GROUP_POLICY_DEFAULT_INVALID') setFieldError(err.message);
      else setSaveError(getApiErrorMessage(err, 'Failed to save the default leverage.'));
    } finally { setSaving(false); }
  };

  if (!state && loading) return <div className="flex items-center justify-center flex-1 text-[#888] text-[11px]">Loading…</div>;
  if (!state && error) return <ActionableErrorState title="Unable to load data" message={error} actionLabel="Refresh" onAction={load} />;
  if (!state) return <div className="flex items-center justify-center flex-1 text-[#555] text-[11px]">No data.</div>;

  const busy = saving || loading;
  const changed = input.trim() !== toInput(state.defaultLeverage);

  return (
    <div className="flex-1 overflow-auto p-5">
      <div className="max-w-[520px] flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-semibold text-[#9cdcfe]">Broker Defaults</span>
          <button onClick={load} disabled={busy}
            className="flex items-center gap-1.5 h-[22px] px-3 bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--bg-surface-3)] text-[#ccc] text-[11px] rounded-[2px] disabled:opacity-50">
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {error && <ActionableErrorState title="Unable to refresh" message={error} actionLabel="Refresh" onAction={load} compact />}

        <div role="status" className="bg-[color:var(--bg-surface-1)] border border-[color:var(--bg-surface-2)] rounded-[3px] px-4 py-3">
          <span className="text-[11px] font-semibold break-words text-[#9cdcfe]">
            Default leverage for new groups: {formatGroupDefaultLeverage(state.defaultLeverage)}
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="broker-default-leverage" className="text-[10px] text-[#888] uppercase tracking-wider">Default leverage</label>
          <input id="broker-default-leverage" value={input} disabled={busy || !canConfigure}
            inputMode="numeric" autoComplete="off" spellCheck={false} placeholder="Not set"
            aria-invalid={Boolean(fieldError)} aria-describedby="broker-default-leverage-hint"
            onChange={e => { setInput(e.target.value); setSaved(false); setSaveError(''); setFieldError(''); }}
            onKeyDown={e => { if (e.key === 'Enter' && canConfigure && changed && !busy) handleSave(); }}
            className="bg-[color:var(--bg-app)] border border-[#555] text-[color:var(--text-primary)] text-[11px] h-[26px] px-2 rounded-[2px] outline-none focus:border-[color:var(--accent-500)] font-mono disabled:opacity-50" />
          <span id="broker-default-leverage-hint" className="text-[10px] text-[#555]">
            Whole number from {GROUP_LEVERAGE_MIN} to {GROUP_LEVERAGE_MAX} (1:x). Blank clears the default.
          </span>
          {fieldError && <span role="alert" className="text-[11px] text-[#f48771]">{fieldError}</span>}
        </div>

        {!canConfigure && (
          <span role="note" className="text-[11px] text-orange-400">Your session lacks the server_admin grant, so the default is read-only.</span>
        )}

        <div className="flex items-center gap-3">
          <button onClick={handleSave} disabled={busy || !changed || !canConfigure}
            className="flex items-center gap-1.5 h-[28px] px-4 bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-[11px] rounded-[2px] disabled:opacity-50">
            <Save size={12} /> {saving ? 'Saving…' : 'Save'}
          </button>
          {saved && !saveError && <span className="text-[11px] text-[#4ec9b0]">Saved</span>}
        </div>

        {saveError && <ActionableErrorState title="Save failed" message={saveError} compact />}

        <div className="text-[10px] text-[#555] mt-2 flex flex-col gap-1">
          <p>New groups start with this leverage. Existing groups are not changed.</p>
          <p>When no default is set, the leverage must be entered for every new group.</p>
        </div>
      </div>
    </div>
  );
};

export default BrokerDefaultsTab;
