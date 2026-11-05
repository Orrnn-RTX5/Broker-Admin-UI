import React, { useState, useEffect } from 'react';
import { ServerConfigService } from '../../services/serverConfig.service';
import { AlertTriangle, RefreshCw, Save } from 'lucide-react';
import ActionableErrorState from '../atoms/ActionableErrorState';
import { getApiErrorMessage } from '../../utils/apiShapes';
import {
  DEMO_DISABLE_CONFIRM_MESSAGE,
  normalizeDemoAccountGroupState,
  buildDemoServerWarning,
  buildDemoGroupStatus,
  buildDemoGroupOptions,
  initialDemoGroupSelection,
  isDemoGroupSelectionChanged,
  buildNettingDemoGroupOptions,
  buildNettingDemoGroupStatus,
  initialNettingDemoGroupSelection,
  isNettingDemoGroupSelectionChanged,
} from '../../utils/demoAccountGroup';

// ─── Demo Accounts ────────────────────────────────────────────────────────────
const DEMO_STATUS_TONE = {
  ok:    { border: 'border-[#4ec9b0]/40', text: 'text-[#4ec9b0]' },
  info:  { border: 'border-[color:var(--accent-500)]/40', text: 'text-[#9cdcfe]' },
  warning: { border: 'border-orange-400/50', text: 'text-orange-400' },
  error: { border: 'border-[#f48771]/50', text: 'text-[#f48771]' },
};

const DemoAccountsTab = () => {
  const [state, setState] = useState(null);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [toggleError, setToggleError] = useState('');
  const [nettingSelected, setNettingSelected] = useState('');
  const [nettingSaving, setNettingSaving] = useState(false);
  const [nettingSaveError, setNettingSaveError] = useState('');
  const [nettingSaved, setNettingSaved] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const next = normalizeDemoAccountGroupState(await ServerConfigService.getDemoAccountGroup());
      setState(next);
      setSelected(initialDemoGroupSelection(next));
      setNettingSelected(initialNettingDemoGroupSelection(next));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Demo account group failed to load.'));
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    setSaved(false);
    try {
      await ServerConfigService.setDemoAccountGroup({ group: selected });
      setSaved(true);
      await load();
    } catch (err) {
      setSaveError(getApiErrorMessage(err, 'Failed to save the demo account group.'));
    } finally { setSaving(false); }
  };

  // Netting demo group Save sends only the netting key; '' switches netting demo accounts off.
  const handleNettingSave = async () => {
    setNettingSaving(true);
    setNettingSaveError('');
    setNettingSaved(false);
    try {
      await ServerConfigService.setDemoAccountGroup({ nettingGroup: nettingSelected });
      setNettingSaved(true);
      await load();
    } catch (err) {
      setNettingSaveError(getApiErrorMessage(err, 'Failed to save the netting demo group.'));
    } finally { setNettingSaving(false); }
  };

  // The admin switch saves immediately; disabling asks for confirmation first.
  const handleToggleSignup = async () => {
    if (!state || toggling) return;
    const next = !state.signupEnabled;
    if (!next && !window.confirm(DEMO_DISABLE_CONFIRM_MESSAGE)) return;
    setToggling(true);
    setToggleError('');
    try {
      await ServerConfigService.setDemoAccountGroup({ signupEnabled: next });
      await load();
    } catch (err) {
      setToggleError(getApiErrorMessage(err, 'Failed to change demo signup.'));
    } finally { setToggling(false); }
  };

  if (!state && loading) return <div className="flex items-center justify-center flex-1 text-[#888] text-[11px]">Loading…</div>;
  if (!state && error) return <ActionableErrorState title="Unable to load data" message={error} actionLabel="Refresh" onAction={load} />;
  if (!state) return <div className="flex items-center justify-center flex-1 text-[#555] text-[11px]">No data.</div>;

  const status = buildDemoGroupStatus(state);
  const tone = DEMO_STATUS_TONE[status.tone] || DEMO_STATUS_TONE.info;
  const options = buildDemoGroupOptions(state);
  const changed = isDemoGroupSelectionChanged(state, selected);
  const serverWarning = buildDemoServerWarning(state);
  const signupOn = state.signupEnabled;
  const busy = saving || toggling || nettingSaving;
  const nettingStatus = buildNettingDemoGroupStatus(state);
  const nettingTone = DEMO_STATUS_TONE[nettingStatus.tone] || DEMO_STATUS_TONE.info;
  const nettingOptions = buildNettingDemoGroupOptions(state);
  const nettingChanged = isNettingDemoGroupSelectionChanged(state, nettingSelected);

  return (
    <div className="flex-1 overflow-auto p-5">
      <div className="max-w-[520px] flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-semibold text-[#9cdcfe]">Demo Accounts</span>
          <button onClick={load} disabled={loading || busy}
            className="flex items-center gap-1.5 h-[22px] px-3 bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--bg-surface-3)] text-[#ccc] text-[11px] rounded-[2px] disabled:opacity-50">
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {error && <ActionableErrorState title="Unable to refresh" message={error} actionLabel="Refresh" onAction={load} compact />}

        {/* Admin switch for web-terminal demo signup (saves immediately). */}
        <div className="bg-[color:var(--bg-surface-1)] border border-[color:var(--bg-surface-2)] rounded-[3px] px-4 py-3 flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <span id="demo-signup-switch-label" className="text-[11px] text-[color:var(--text-primary)] flex-1">
              Allow demo account creation from the web terminal
            </span>
            <button type="button" role="switch" aria-checked={signupOn} aria-labelledby="demo-signup-switch-label"
              onClick={handleToggleSignup} disabled={busy || loading}
              className={`relative w-[34px] h-[18px] rounded-full border transition-colors disabled:opacity-50 shrink-0 ${signupOn ? 'bg-[#4ec9b0]/30 border-[#4ec9b0]/60' : 'bg-[color:var(--bg-surface-2)] border-[#555]'}`}>
              <span className={`absolute top-[2px] w-[12px] h-[12px] rounded-full transition-all ${signupOn ? 'left-[18px] bg-[#4ec9b0]' : 'left-[2px] bg-[#888]'}`} />
            </button>
            <span className={`text-[11px] font-semibold w-[64px] ${signupOn ? 'text-[#4ec9b0]' : 'text-orange-400'}`}>
              {toggling ? 'Saving…' : signupOn ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          {!state.serverEnabled && (
            <span className="text-[10px] text-[#888]">
              This switch has no effect until demo signup is switched on on the server.
            </span>
          )}
          {toggleError && <ActionableErrorState title="Change failed" message={toggleError} compact />}
        </div>

        {serverWarning && (
          <div role="alert" className="bg-[#f48771]/10 border border-[#f48771]/50 rounded-[3px] px-4 py-3 flex items-start gap-2">
            <AlertTriangle size={13} className="text-[#f48771] shrink-0 mt-0.5" />
            <span className="text-[11px] font-semibold break-words text-[#f48771]">{serverWarning}</span>
          </div>
        )}

        <div role="status" className={`bg-[color:var(--bg-surface-1)] border rounded-[3px] px-4 py-3 flex items-start gap-2 ${tone.border}`}>
          {(status.tone === 'error' || status.tone === 'warning') && <AlertTriangle size={13} className={`${tone.text} shrink-0 mt-0.5`} />}
          <span className={`text-[11px] font-semibold break-words ${tone.text}`}>{status.message}</span>
        </div>

        {/* Group section: stays usable when signup is off, but visually secondary. */}
        <div className={`flex flex-col gap-4 transition-opacity ${signupOn ? '' : 'opacity-60'}`}>
          <div className="flex flex-col gap-1">
            <span className="text-[12px] font-semibold text-[#9cdcfe]">Demo Account Group</span>
            <p className="text-[11px] text-[#888]">Demo accounts created from the web terminal are opened in this group.</p>
            {!signupOn && (
              <p className="text-[10px] text-orange-400">Demo signup is disabled — the group applies once signup is enabled.</p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="demo-account-group-select" className="text-[10px] text-[#888] uppercase tracking-wider">Demo group</label>
            <select id="demo-account-group-select" value={selected} disabled={busy}
              onChange={e => { setSelected(e.target.value); setSaved(false); setSaveError(''); }}
              className="bg-[color:var(--bg-app)] border border-[#555] text-[color:var(--text-primary)] text-[11px] h-[26px] px-2 rounded-[2px] outline-none focus:border-[color:var(--accent-500)] font-mono disabled:opacity-50">
              {options.map(o => (
                <option key={o.value || '__automatic__'} value={o.value} disabled={o.disabled}>{o.label}</option>
              ))}
            </select>
            {state.demoGroups.length === 0 && (
              <span className="text-[10px] text-[#555]">No enabled demo groups found for this broker.</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button onClick={handleSave} disabled={busy || !changed}
              className="flex items-center gap-1.5 h-[28px] px-4 bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-[11px] rounded-[2px] disabled:opacity-50">
              <Save size={12} /> {saving ? 'Saving…' : 'Save'}
            </button>
            {saved && !saveError && <span className="text-[11px] text-[#4ec9b0]">Saved</span>}
          </div>

          {saveError && <ActionableErrorState title="Save failed" message={saveError} compact />}

          <div className="text-[10px] text-[#555] mt-2 flex flex-col gap-1">
            <p>Change: pick another group and Save.</p>
            <p>Automatic: new demo accounts go to the alphabetically first demo group.</p>
            <p>To stop demo accounts entirely, use the switch above.</p>
            <p>Only this broker's enabled groups with "Demo Account" checked can be selected.</p>
          </div>
        </div>

        {/* Netting demo group: shown only when the backend reports the setting. */}
        {state.nettingSupported && (
          <div className={`flex flex-col gap-4 border-t border-[color:var(--bg-surface-2)] pt-4 transition-opacity ${signupOn ? '' : 'opacity-60'}`}>
            <div className="flex flex-col gap-1">
              <span className="text-[12px] font-semibold text-[#9cdcfe]">Netting Demo Group</span>
              <p className="text-[11px] text-[#888]">Netting demo accounts created from the web terminal login are opened in this group.</p>
            </div>

            <div role="status" className={`bg-[color:var(--bg-surface-1)] border rounded-[3px] px-4 py-3 flex items-start gap-2 ${nettingTone.border}`}>
              {(nettingStatus.tone === 'error' || nettingStatus.tone === 'warning') && <AlertTriangle size={13} className={`${nettingTone.text} shrink-0 mt-0.5`} />}
              <span className={`text-[11px] font-semibold break-words ${nettingTone.text}`}>{nettingStatus.message}</span>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="netting-demo-group-select" className="text-[10px] text-[#888] uppercase tracking-wider">Netting demo group</label>
              <select id="netting-demo-group-select" value={nettingSelected} disabled={busy}
                onChange={e => { setNettingSelected(e.target.value); setNettingSaved(false); setNettingSaveError(''); }}
                className="bg-[color:var(--bg-app)] border border-[#555] text-[color:var(--text-primary)] text-[11px] h-[26px] px-2 rounded-[2px] outline-none focus:border-[color:var(--accent-500)] font-mono disabled:opacity-50">
                {nettingOptions.map(o => (
                  <option key={o.value || '__off__'} value={o.value} disabled={o.disabled}>{o.label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={handleNettingSave} disabled={busy || !nettingChanged}
                className="flex items-center gap-1.5 h-[28px] px-4 bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-[11px] rounded-[2px] disabled:opacity-50">
                <Save size={12} /> {nettingSaving ? 'Saving…' : 'Save'}
              </button>
              {nettingSaved && !nettingSaveError && <span className="text-[11px] text-[#4ec9b0]">Saved</span>}
            </div>

            {nettingSaveError && <ActionableErrorState title="Save failed" message={nettingSaveError} compact />}

            <p className="text-[10px] text-[#555]">Only this broker's enabled demo groups with margin mode Netting can be selected. Off: the terminal offers no netting demo account.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DemoAccountsTab;
