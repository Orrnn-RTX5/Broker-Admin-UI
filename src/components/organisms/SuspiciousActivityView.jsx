import React, { useState, useEffect } from 'react';
import { RiskManagementService } from '../../services/riskManagement.service';
import { RefreshCw, BarChart2 } from 'lucide-react';

const PATTERN_TYPES = ['', 'high_win_rate', 'scalping', 'latency_arbitrage', 'tick_scalping', 'news_trading'];
const REVIEW_ACTIONS = ['restrict', 'warn', 'ignore'];
const severityColor = (s) => ({ low: 'text-[#888]', medium: 'text-[#d4a017]', high: 'text-[#f48771]', critical: 'text-[#ff3333]' }[s] || 'text-[#888]');
const tsFormat = (ts) => ts ? new Date(ts * 1000).toLocaleString() : '—';

const SuspiciousActivityView = () => {
  const [data, setData] = useState([]);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [reviewed, setReviewed] = useState('false');
  const [patternType, setPatternType] = useState('');
  const [reviewModal, setReviewModal] = useState(null);
  const [reviewForm, setReviewForm] = useState({ action: 'warn', notes: '' });
  const [saving, setSaving] = useState(false);

  const fetchList = async () => {
    setLoading(true);
    try {
      const params = {};
      if (reviewed !== '') params.reviewed = reviewed;
      if (patternType) params.pattern_type = patternType;
      const res = await RiskManagementService.listSuspicious(params);
      setData(Array.isArray(res) ? res : []);
    } catch { setData([]); }
    finally { setLoading(false); }
  };

  const fetchStats = async () => {
    try {
      const res = await RiskManagementService.getSuspiciousStats();
      setStats(Array.isArray(res) ? res : []);
    } catch { setStats([]); }
  };

  useEffect(() => { fetchList(); fetchStats(); }, []);

  const handleReview = async () => {
    if (!reviewModal) return;
    setSaving(true);
    try {
      await RiskManagementService.reviewSuspicious(reviewModal.id, reviewForm.action, reviewForm.notes);
      setData(d => d.map(r => r.id === reviewModal.id ? { ...r, reviewed: true, action_taken: reviewForm.action, notes: reviewForm.notes } : r));
      setReviewModal(null);
      setReviewForm({ action: 'warn', notes: '' });
    } catch (err) {
      alert('Failed: ' + (err.response?.data?.message || err.message));
    } finally { setSaving(false); }
  };

  return (
    <div className="flex-1 bg-[color:var(--bg-app)] flex flex-col overflow-hidden">
      {/* Top Bar */}
      <div className="flex items-center gap-3 px-3 py-1.5 bg-[color:var(--bg-surface-1)] border-b border-black/40 shrink-0">
        <button onClick={fetchList}
          className="flex items-center gap-1.5 h-[24px] px-3 bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--bg-surface-3)] text-[#ccc] text-[11px] rounded-[2px]">
          <RefreshCw size={11} /> Refresh
        </button>
        <button onClick={() => { fetchStats(); setShowStats(s => !s); }}
          className={`flex items-center gap-1.5 h-[24px] px-3 text-[11px] rounded-[2px] transition-colors ${showStats ? 'bg-[color:var(--accent-700)] text-[#9cdcfe]' : 'bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--bg-surface-3)] text-[#ccc]'}`}>
          <BarChart2 size={11} /> Stats
        </button>
        <div className="flex items-center gap-2 ml-2">
          <select value={patternType} onChange={e => setPatternType(e.target.value)}
            className="bg-[color:var(--bg-app)] border border-[#555] text-[color:var(--text-primary)] text-[11px] h-[22px] px-1.5 rounded-[2px] outline-none">
            {PATTERN_TYPES.map(p => <option key={p} value={p}>{p || 'All patterns'}</option>)}
          </select>
          <select value={reviewed} onChange={e => setReviewed(e.target.value)}
            className="bg-[color:var(--bg-app)] border border-[#555] text-[color:var(--text-primary)] text-[11px] h-[22px] px-1.5 rounded-[2px] outline-none">
            <option value="">All</option>
            <option value="false">Unreviewed</option>
            <option value="true">Reviewed</option>
          </select>
          <button onClick={fetchList}
            className="h-[22px] px-3 bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--bg-surface-3)] text-[#ccc] text-[11px] rounded-[2px]">Load</button>
        </div>
      </div>

      {/* Stats Panel */}
      {showStats && (
        <div className="flex gap-3 px-3 py-2 bg-[#1a1a2e] border-b border-black/40 shrink-0 flex-wrap">
          {stats.length === 0
            ? <span className="text-[#555] text-[11px]">No stats</span>
            : stats.map(s => (
              <div key={s.pattern_type + s.severity}
                className="flex items-center gap-2 bg-[color:var(--bg-surface-1)] border border-[color:var(--bg-surface-2)] rounded-[3px] px-3 h-[28px]">
                <span className="text-[11px] text-[#9cdcfe]">{s.pattern_type}</span>
                <span className={`text-[10px] font-semibold ${severityColor(s.severity)}`}>{s.severity}</span>
                <span className="text-[12px] font-bold text-[color:var(--text-primary)]">{s.count}</span>
              </div>
            ))}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center px-3 h-[24px] bg-[color:var(--bg-surface-1)] border-b border-black/30 shrink-0">
        {[['ID','w-12'],['Pattern','w-40'],['Account','w-24'],['Severity','w-24'],['Evidence','flex-1'],['Reviewed','w-20'],['Action','w-24'],['Detected','w-40']].map(([l,w]) => (
          <div key={l} className={`${w} text-[10px] font-semibold text-[#888] uppercase tracking-wider pr-2`}>{l}</div>
        ))}
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-auto">
        {loading ? <div className="flex items-center justify-center h-24 text-[#888] text-[11px]">Loading…</div>
          : data.length === 0 ? <div className="flex items-center justify-center h-24 text-[#555] text-[11px]">No suspicious activity found</div>
          : data.map((row, i) => (
            <div key={row.id}
              onDoubleClick={() => !row.reviewed && setReviewModal(row)}
              title={!row.reviewed ? 'Double-click to review' : ''}
              className={`flex items-center px-3 h-[22px] border-b border-black/20 cursor-default select-none ${i % 2 === 0 ? 'bg-[color:var(--bg-app)]' : 'bg-[color:var(--bg-surface-1)]'} hover:bg-[#2a2d2e]`}>
              <div className="w-12 text-[11px] text-[color:var(--text-primary)] pr-2">{row.id}</div>
              <div className="w-40 text-[11px] text-[#9cdcfe] pr-2 truncate">{row.pattern_type}</div>
              <div className="w-24 text-[11px] text-[color:var(--text-primary)] pr-2">{row.account_login}</div>
              <div className={`w-24 text-[11px] pr-2 font-semibold ${severityColor(row.severity)}`}>{row.severity}</div>
              <div className="flex-1 text-[11px] text-[#888] pr-2 truncate font-mono">
                {row.evidence ? JSON.stringify(row.evidence) : '—'}
              </div>
              <div className="w-20 pr-2">
                <span className={row.reviewed ? 'text-[#4ec9b0] text-[11px]' : 'text-[#555] text-[11px]'}>{row.reviewed ? 'Yes' : 'No'}</span>
              </div>
              <div className="w-24 text-[11px] text-[#888] pr-2">{row.action_taken || '—'}</div>
              <div className="w-40 text-[11px] text-[#888]">{tsFormat(row.detection_time)}</div>
            </div>
          ))}
      </div>

      {/* Review Modal */}
      {reviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[color:var(--bg-surface-1)] border border-[color:var(--bg-surface-3)] rounded-[3px] shadow-2xl w-[360px] p-5 flex flex-col gap-3"
            onClick={e => e.stopPropagation()}>
            <div className="text-[12px] font-semibold text-[color:var(--text-primary)]">Review Suspicious #{reviewModal.id}</div>
            <div className="text-[11px] text-[#9cdcfe]">{reviewModal.pattern_type} — Account {reviewModal.account_login}</div>
            <div className="text-[11px] text-[#888] font-mono bg-[color:var(--bg-app)] p-2 rounded-[2px] max-h-[60px] overflow-auto">
              {JSON.stringify(reviewModal.evidence, null, 2)}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-[#888] uppercase tracking-wider">Action</label>
              <select value={reviewForm.action} onChange={e => setReviewForm(f => ({ ...f, action: e.target.value }))}
                className="bg-[color:var(--bg-app)] border border-[#555] text-[color:var(--text-primary)] text-[11px] h-[24px] px-1.5 rounded-[2px] outline-none focus:border-[color:var(--accent-500)]">
                {REVIEW_ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-[#888] uppercase tracking-wider">Notes</label>
              <textarea value={reviewForm.notes} onChange={e => setReviewForm(f => ({ ...f, notes: e.target.value }))}
                rows={3} placeholder="Optional notes…"
                className="bg-[color:var(--bg-app)] border border-[#555] text-[color:var(--text-primary)] text-[11px] px-2 py-1 rounded-[2px] outline-none focus:border-[color:var(--accent-500)] resize-none" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setReviewModal(null)}
                className="h-[24px] px-4 bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--bg-surface-3)] text-[#ccc] text-[11px] rounded-[2px]">Cancel</button>
              <button onClick={handleReview} disabled={saving}
                className="h-[24px] px-4 bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-[11px] rounded-[2px] disabled:opacity-50">
                {saving ? 'Saving…' : 'Submit Review'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuspiciousActivityView;
