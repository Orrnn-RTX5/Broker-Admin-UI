import React, { useCallback, useState, useEffect } from 'react';
import { RiskManagementService } from '../../services/riskManagement.service';
import { RefreshCw, CheckCheck, Check } from 'lucide-react';

const SEVERITIES = ['', 'low', 'medium', 'high', 'critical'];
const severityColor = (s) => ({ low: 'text-[#888]', medium: 'text-[#d4a017]', high: 'text-[#f48771]', critical: 'text-[#ff3333]' }[s] || 'text-[#888]');
const tsFormat = (ts) => ts ? new Date(ts * 1000).toLocaleString() : '—';

const RiskEventsView = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [severity, setSeverity] = useState('');
  const [acknowledged, setAcknowledged] = useState('false');
  const [acking, setAcking] = useState(null);
  const [ackingAll, setAckingAll] = useState(false);
  const [showAckModal, setShowAckModal] = useState(null); // event object
  const [comment, setComment] = useState('');

  const loadEvents = useCallback(async ({ severityFilter, acknowledgedFilter }) => {
    setLoading(true);
    try {
      const params = {};
      if (severityFilter) params.severity = severityFilter;
      if (acknowledgedFilter !== '') params.acknowledged = acknowledgedFilter;
      const res = await RiskManagementService.listRiskEvents(params);
      setData(Array.isArray(res) ? res : []);
    } catch { setData([]); }
    finally { setLoading(false); }
  }, []);

  const fetchEvents = useCallback(() => {
    return loadEvents({ severityFilter: severity, acknowledgedFilter: acknowledged });
  }, [acknowledged, loadEvents, severity]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      loadEvents({ severityFilter: '', acknowledgedFilter: 'false' });
    }, 0);
    return () => window.clearTimeout(timerId);
  }, [loadEvents]);

  const handleAck = async () => {
    if (!showAckModal) return;
    setAcking(showAckModal.id);
    try {
      await RiskManagementService.ackRiskEvent(showAckModal.id, comment);
      setData(d => d.map(e => e.id === showAckModal.id ? { ...e, acknowledged: true } : e));
    } catch (err) {
      alert('Failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setAcking(null);
      setShowAckModal(null);
      setComment('');
    }
  };

  const handleAckAll = async () => {
    if (!window.confirm('Acknowledge all unacknowledged events?')) return;
    setAckingAll(true);
    try {
      const res = await RiskManagementService.ackAllRiskEvents();
      alert(`Acknowledged ${res.acknowledged_count ?? 'all'} events.`);
      fetchEvents();
    } catch (err) {
      alert('Failed: ' + (err.response?.data?.message || err.message));
    } finally { setAckingAll(false); }
  };

  return (
    <div className="flex-1 bg-[color:var(--bg-app)] flex flex-col overflow-hidden">
      {/* Top Bar */}
      <div className="flex items-center gap-3 px-3 py-1.5 bg-[color:var(--bg-surface-1)] border-b border-black/40 shrink-0">
        <button onClick={fetchEvents}
          className="flex items-center gap-1.5 h-[24px] px-3 bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--bg-surface-3)] text-[#ccc] text-[11px] rounded-[2px]">
          <RefreshCw size={11} /> Refresh
        </button>
        <button onClick={handleAckAll} disabled={ackingAll}
          className="flex items-center gap-1.5 h-[24px] px-3 bg-[#2d5a1b] hover:bg-[#3a7022] text-[#4ec9b0] text-[11px] rounded-[2px] disabled:opacity-50">
          <CheckCheck size={11} /> {ackingAll ? 'Acknowledging…' : 'Ack All'}
        </button>
        <div className="flex items-center gap-2 ml-2">
          <select value={severity} onChange={e => setSeverity(e.target.value)}
            className="bg-[color:var(--bg-app)] border border-[#555] text-[color:var(--text-primary)] text-[11px] h-[22px] px-1.5 rounded-[2px] outline-none">
            <option value="">All severities</option>
            {SEVERITIES.filter(Boolean).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={acknowledged} onChange={e => setAcknowledged(e.target.value)}
            className="bg-[color:var(--bg-app)] border border-[#555] text-[color:var(--text-primary)] text-[11px] h-[22px] px-1.5 rounded-[2px] outline-none">
            <option value="">All</option>
            <option value="false">Unacknowledged</option>
            <option value="true">Acknowledged</option>
          </select>
          <button onClick={fetchEvents}
            className="h-[22px] px-3 bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--bg-surface-3)] text-[#ccc] text-[11px] rounded-[2px]">
            Load
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center px-3 h-[24px] bg-[color:var(--bg-surface-1)] border-b border-black/30 shrink-0">
        {[['ID','w-12'],['Event Type','w-40'],['Severity','w-24'],['Account','w-24'],['Symbol','w-24'],['Triggered','w-28'],['Limit','w-24'],['Action','w-28'],['Acked','w-20'],['Time','w-40']].map(([l,w]) => (
          <div key={l} className={`${w} text-[10px] font-semibold text-[#888] uppercase tracking-wider pr-2`}>{l}</div>
        ))}
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-auto">
        {loading ? <div className="flex items-center justify-center h-24 text-[#888] text-[11px]">Loading…</div>
          : data.length === 0 ? <div className="flex items-center justify-center h-24 text-[#555] text-[11px]">No events found</div>
          : data.map((row, i) => (
            <div key={row.id}
              onDoubleClick={() => !row.acknowledged && setShowAckModal(row)}
              className={`flex items-center px-3 h-[22px] border-b border-black/20 cursor-default select-none ${i % 2 === 0 ? 'bg-[color:var(--bg-app)]' : 'bg-[color:var(--bg-surface-1)]'} hover:bg-[#2a2d2e]`}
              title="Double-click to acknowledge">
              <div className="w-12 text-[11px] text-[color:var(--text-primary)] pr-2">{row.id}</div>
              <div className="w-40 text-[11px] text-[color:var(--text-primary)] pr-2 truncate">{row.event_type}</div>
              <div className={`w-24 text-[11px] pr-2 font-semibold ${severityColor(row.severity)}`}>{row.severity}</div>
              <div className="w-24 text-[11px] text-[#9cdcfe] pr-2">{row.account_login || '—'}</div>
              <div className="w-24 text-[11px] text-[#9cdcfe] pr-2 font-mono">{row.symbol || '—'}</div>
              <div className="w-28 text-[11px] text-[#f48771] pr-2">{typeof row.triggered_value === 'number' ? row.triggered_value.toFixed(2) : '—'}</div>
              <div className="w-24 text-[11px] text-[#888] pr-2">{typeof row.limit_value === 'number' ? row.limit_value.toFixed(2) : '—'}</div>
              <div className="w-28 text-[11px] text-[#888] pr-2 truncate">{row.action_taken || '—'}</div>
              <div className="w-20 pr-2">
                {row.acknowledged
                  ? <Check size={12} className="text-[#4ec9b0]" />
                  : <span className="text-[10px] text-[#555]">No</span>}
              </div>
              <div className="w-40 text-[11px] text-[#888]">{tsFormat(row.triggered_at)}</div>
            </div>
          ))}
      </div>

      {/* Ack Modal */}
      {showAckModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[color:var(--bg-surface-1)] border border-[color:var(--bg-surface-3)] rounded-[3px] shadow-2xl w-[340px] p-5 flex flex-col gap-3"
            onClick={e => e.stopPropagation()}>
            <div className="text-[12px] font-semibold text-[color:var(--text-primary)]">Acknowledge Event #{showAckModal.id}</div>
            <div className="text-[11px] text-[#888]">{showAckModal.event_type} — {showAckModal.description}</div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-[#888] uppercase tracking-wider">Comment (optional)</label>
              <input value={comment} onChange={e => setComment(e.target.value)} placeholder="e.g. Reviewed and noted"
                className="bg-[color:var(--bg-app)] border border-[#555] text-[color:var(--text-primary)] text-[11px] h-[24px] px-2 rounded-[2px] outline-none focus:border-[color:var(--accent-500)]" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowAckModal(null); setComment(''); }}
                className="h-[24px] px-4 bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--bg-surface-3)] text-[#ccc] text-[11px] rounded-[2px]">Cancel</button>
              <button onClick={handleAck} disabled={!!acking}
                className="h-[24px] px-4 bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-[11px] rounded-[2px] disabled:opacity-50">
                {acking ? 'Saving…' : 'Acknowledge'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RiskEventsView;
