import React, { useCallback, useState, useEffect } from 'react';
import { ReportsService } from '../../services/reports.service';
import { Download, RefreshCw, Search } from 'lucide-react';

const TAB_REPORT = 'Report Export';
const TAB_AUDIT = 'Audit Export';
const TAB_KYC = 'KYC Report';

const today = () => new Date().toISOString().split('T')[0];
const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split('T')[0]; };

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

const fmt = (v) => (v == null ? '—' : typeof v === 'boolean' ? String(v) : typeof v === 'number' ? v : String(v));

const DataTable = ({ data }) => {
  if (!Array.isArray(data) || data.length === 0)
    return <div className="flex items-center justify-center h-24 text-[#555] text-[11px]">No records found.</div>;
  const cols = Object.keys(data[0]);
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center px-3 h-[24px] bg-[color:var(--bg-surface-1)] border-b border-black/30 shrink-0">
        {cols.map(c => <div key={c} className="min-w-[130px] text-[10px] font-semibold text-[#888] uppercase tracking-wider pr-3">{c.replace(/_/g, ' ')}</div>)}
      </div>
      <div className="flex-1 overflow-auto">
        {data.map((row, i) => (
          <div key={i} className={`flex items-center px-3 h-[22px] border-b border-black/20 ${i % 2 === 0 ? 'bg-[color:var(--bg-app)]' : 'bg-[color:var(--bg-surface-1)]'} hover:bg-[#2a2d2e]`}>
            {cols.map(c => (
              <div key={c} className="min-w-[130px] text-[11px] text-[color:var(--text-primary)] pr-3 truncate font-mono">{fmt(row[c])}</div>
            ))}
          </div>
        ))}
      </div>
      <div className="px-3 h-[22px] flex items-center bg-[color:var(--bg-surface-1)] border-t border-black/30 shrink-0">
        <span className="text-[10px] text-[#555]">{data.length} record{data.length !== 1 ? 's' : ''}</span>
      </div>
    </div>
  );
};

// ─── Report Export Tab ──────────────────────────────────────────────────────
const ReportExportTab = () => {
  const [report, setReport] = useState('accounts');
  const [format, setFormat] = useState('json');
  const [from, setFrom] = useState(yesterday());
  const [to, setTo] = useState(today());
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const needsDates = report !== 'accounts';

  const handleLoad = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const f = needsDates ? from : undefined;
      const t = needsDates ? to : undefined;
      const res = await ReportsService.getReportExport(report, format, f, t);
      if (format === 'csv') {
        downloadBlob(res, `${report}_export_${today()}.csv`);
      } else {
        setResult(Array.isArray(res) ? res : [res]);
      }
    } catch (err) {
      alert('Failed: ' + (err.response?.data?.message || err.message));
    } finally { setLoading(false); }
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <form onSubmit={handleLoad} className="flex items-center gap-3 px-3 py-2 bg-[color:var(--bg-surface-1)] border-b border-black/30 shrink-0 flex-wrap">
        {/* Report type */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-[#888]">Report *</span>
          <select value={report} onChange={e => { setReport(e.target.value); setResult(null); }}
            className="bg-[color:var(--bg-app)] border border-[#555] text-[color:var(--text-primary)] text-[11px] h-[22px] px-1.5 rounded-[2px] outline-none focus:border-[color:var(--accent-500)]">
            <option value="accounts">Accounts</option>
            <option value="positions">Positions</option>
            <option value="deals">Deals</option>
          </select>
        </div>
        {/* Format */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-[#888]">Format</span>
          <select value={format} onChange={e => setFormat(e.target.value)}
            className="bg-[color:var(--bg-app)] border border-[#555] text-[color:var(--text-primary)] text-[11px] h-[22px] px-1.5 rounded-[2px] outline-none focus:border-[color:var(--accent-500)]">
            <option value="json">JSON (inline)</option>
            <option value="csv">CSV (download)</option>
          </select>
        </div>
        {/* Date range — only for positions/deals */}
        {needsDates && (
          <>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-[#f48771]">From *</span>
              <input type="date" required value={from} onChange={e => setFrom(e.target.value)}
                className="bg-[color:var(--bg-app)] border border-[#555] text-[color:var(--text-primary)] text-[11px] h-[22px] px-2 rounded-[2px] outline-none focus:border-[color:var(--accent-500)]" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-[#f48771]">To *</span>
              <input type="date" required value={to} onChange={e => setTo(e.target.value)}
                className="bg-[color:var(--bg-app)] border border-[#555] text-[color:var(--text-primary)] text-[11px] h-[22px] px-2 rounded-[2px] outline-none focus:border-[color:var(--accent-500)]" />
            </div>
          </>
        )}
        <button type="submit" disabled={loading}
          className="flex items-center gap-1.5 h-[22px] px-3 bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-[11px] rounded-[2px] disabled:opacity-50">
          {format === 'csv' ? <Download size={11} /> : <Search size={11} />}
          {loading ? 'Loading…' : format === 'csv' ? 'Download CSV' : 'Load'}
        </button>
      </form>
      {!loading && result && <DataTable data={result} />}
      {!loading && !result && (
        <div className="flex items-center justify-center flex-1 text-[#555] text-[11px]">
          Configure fields above and click Load.
        </div>
      )}
      {loading && <div className="flex items-center justify-center flex-1 text-[#888] text-[11px]">Loading…</div>}
    </div>
  );
};

// ─── Audit Export Tab ───────────────────────────────────────────────────────
const AuditExportTab = () => {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const blob = await ReportsService.getAuditExport(undefined, undefined, 'csv', undefined);
      downloadBlob(blob, `audit_export_${today()}.csv`);
    } catch (err) {
      alert('Export failed: ' + (err.response?.data?.message || err.message));
    } finally { setLoading(false); }
  };

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="bg-[color:var(--bg-surface-1)] border border-[color:var(--bg-surface-2)] rounded-[3px] p-5 flex flex-col gap-3 w-[280px]">
        <div className="flex items-center gap-2">
          <Download size={16} className="text-[#d4a017]" />
          <span className="text-[12px] font-semibold text-[color:var(--text-primary)]">Audit Trail Export</span>
        </div>
        <p className="text-[11px] text-[#888] leading-relaxed">
          Export the full audit trail log including all admin actions, logins, and configuration changes.
        </p>
        <button onClick={handleExport} disabled={loading}
          className="flex items-center justify-center gap-1.5 h-[26px] px-4 bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-[11px] rounded-[2px] disabled:opacity-50 mt-1">
          <Download size={11} /> {loading ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>
    </div>
  );
};

// ─── KYC Report Tab ─────────────────────────────────────────────────────────
const KYCReportTab = () => {
  const [verified, setVerified] = useState('false');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ReportsService.getKYCReport(verified);
      setData(Array.isArray(res) ? res : []);
    } catch (err) {
      alert('Failed: ' + (err.response?.data?.message || err.message));
    } finally { setLoading(false); }
  }, [verified]);

  useEffect(() => {
    const timerId = window.setTimeout(load, 0);
    return () => window.clearTimeout(timerId);
  }, [load]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center gap-3 px-3 py-2 bg-[color:var(--bg-surface-1)] border-b border-black/30 shrink-0">
        <span className="text-[10px] text-[#888]">KYC Status</span>
        <select value={verified} onChange={e => setVerified(e.target.value)}
          className="bg-[color:var(--bg-app)] border border-[#555] text-[color:var(--text-primary)] text-[11px] h-[22px] px-1.5 rounded-[2px] outline-none focus:border-[color:var(--accent-500)]">
          <option value="false">Unverified (missing KYC)</option>
          <option value="true">Verified</option>
        </select>
        <button onClick={load} className="flex items-center gap-1.5 h-[22px] px-3 bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--bg-surface-3)] text-[#ccc] text-[11px] rounded-[2px]">
          <RefreshCw size={11} /> Refresh
        </button>
      </div>
      {loading
        ? <div className="flex items-center justify-center flex-1 text-[#888] text-[11px]">Loading…</div>
        : <DataTable data={data ?? []} />}
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────
const DataExportsView = () => {
  const [tab, setTab] = useState(TAB_REPORT);

  return (
    <div className="flex-1 bg-[color:var(--bg-app)] flex flex-col overflow-hidden">
      <div className="flex items-center bg-[color:var(--bg-surface-1)] border-b border-black/40 shrink-0">
        {[TAB_REPORT, TAB_AUDIT, TAB_KYC].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 h-[30px] text-[11px] border-r border-black/30 transition-colors ${tab === t ? 'bg-[color:var(--bg-app)] text-[color:var(--text-primary)] border-t-2 border-t-[color:var(--accent-500)]' : 'text-[#888] hover:text-[#ccc]'}`}>
            {t}
          </button>
        ))}
      </div>
      {tab === TAB_REPORT && <ReportExportTab />}
      {tab === TAB_AUDIT && <AuditExportTab />}
      {tab === TAB_KYC && <KYCReportTab />}
    </div>
  );
};

export default DataExportsView;
