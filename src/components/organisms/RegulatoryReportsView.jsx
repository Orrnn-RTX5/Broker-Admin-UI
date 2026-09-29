import React, { useState } from 'react';
import { ReportsService } from '../../services/reports.service';
import { Search } from 'lucide-react';

const TABS = ['EMIR', 'MiFID', 'Reconciliation', 'Daily Transactions', 'Generate Report', 'Best Execution'];

const today = () => new Date().toISOString().split('T')[0];
const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split('T')[0]; };
const fmt = (v) => (v == null ? '—' : typeof v === 'number' ? v.toFixed(4) : String(v));
const pnlColor = (v) => (v > 0 ? 'text-[color:var(--success-500)]' : v < 0 ? 'text-[color:var(--danger-500)]' : 'text-[color:var(--text-primary)]');

const DataTable = ({ data }) => {
  if (!Array.isArray(data) || data.length === 0)
    return <div className="flex items-center justify-center h-24 text-white text-[11px]">No data found.</div>;
  const cols = Object.keys(data[0]);
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center px-3 h-[24px] bg-[color:var(--bg-surface-1)] border-b border-black/30 shrink-0">
        {cols.map(c => <div key={c} className="min-w-[130px] text-[10px] font-semibold text-white uppercase tracking-wider pr-3">{c.replace(/_/g,' ')}</div>)}
      </div>
      <div className="flex-1 overflow-auto">
        {data.map((row, i) => (
          <div key={i} className={`flex items-center px-3 h-[22px] border-b border-black/20 ${i % 2 === 0 ? 'bg-[color:var(--bg-app)]' : 'bg-[color:var(--bg-surface-1)]'} hover:bg-[#2a2d2e]`}>
            {cols.map(c => {
              const v = row[c];
              const isProfit = c.includes('profit') || c.includes('revenue');
              return (
                <div key={c} className={`min-w-[130px] text-[11px] pr-3 truncate font-mono ${isProfit && typeof v === 'number' ? pnlColor(v) : 'text-[color:var(--text-primary)]'}`}>
                  {fmt(v)}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="px-3 h-[22px] flex items-center bg-[color:var(--bg-surface-1)] border-t border-black/30 shrink-0">
        <span className="text-[10px] text-white">{data.length} record{data.length !== 1 ? 's' : ''}</span>
      </div>
    </div>
  );
};

const KVCard = ({ data, title }) => {
  if (!data) return null;
  return (
    <div className="p-6 max-w-[440px]">
      {title && <div className="text-[12px] font-semibold text-white mb-3">{title}</div>}
      <div className="bg-[color:var(--bg-surface-1)] border border-[color:var(--bg-surface-2)] rounded-[3px] divide-y divide-black/30">
        {Object.entries(data).map(([k, v]) => {
          const isNum = typeof v === 'number';
          const isProfit = k.includes('profit') || k.includes('revenue') || k.includes('difference');
          return (
            <div key={k} className="flex items-center px-4 h-[34px]">
              <span className="text-[11px] text-white flex-1">{k.replace(/_/g, ' ')}</span>
              <span className={`text-[13px] font-mono font-semibold ${isProfit && isNum ? pnlColor(v) : isNum ? 'text-white' : typeof v === 'boolean' ? (v ? 'text-white' : 'text-[#f48771]') : 'text-[color:var(--text-primary)]'}`}>
                {isNum ? v.toFixed(2) : String(v)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── EMIR / MiFID ────────────────────────────────────────────────────────────
const DateRangeReport = ({ onLoad }) => {
  const [from, setFrom] = useState(yesterday());
  const [to, setTo] = useState(today());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setData(null);
    try {
      const res = await onLoad(from, to);
      setData(Array.isArray(res) ? res : [res]);
    } catch (err) {
      alert('Failed: ' + (err.response?.data?.message || err.message));
    } finally { setLoading(false); }
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <form onSubmit={handleSubmit} className="flex items-center gap-3 px-3 py-2 bg-[color:var(--bg-surface-1)] border-b border-black/30 shrink-0">
        <span className="text-[10px] text-[#f48771]">From *</span>
        <input type="date" required value={from} onChange={e => setFrom(e.target.value)}
          className="bg-[color:var(--bg-app)] border border-[#555] text-[color:var(--text-primary)] text-[11px] h-[22px] px-2 rounded-[2px] outline-none focus:border-[color:var(--accent-500)]" />
        <span className="text-[10px] text-[#f48771]">To *</span>
        <input type="date" required value={to} onChange={e => setTo(e.target.value)}
          className="bg-[color:var(--bg-app)] border border-[#555] text-[color:var(--text-primary)] text-[11px] h-[22px] px-2 rounded-[2px] outline-none focus:border-[color:var(--accent-500)]" />
        <button type="submit" disabled={loading}
          className="flex items-center gap-1.5 h-[22px] px-3 bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-[11px] rounded-[2px] disabled:opacity-50">
          <Search size={11} /> {loading ? 'Loading…' : 'Load'}
        </button>
      </form>
      {loading
        ? <div className="flex items-center justify-center flex-1 text-white text-[11px]">Loading…</div>
        : data
          ? <DataTable data={data} />
          : <div className="flex items-center justify-center flex-1 text-white text-[11px]">Set date range and click Load.</div>}
    </div>
  );
};

// ─── Single Date Reports ─────────────────────────────────────────────────────
const SingleDateReport = ({ onLoad, renderResult }) => {
  const [date, setDate] = useState(yesterday());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setData(null);
    try {
      const res = await onLoad(date);
      setData(res);
    } catch (err) {
      alert('Failed: ' + (err.response?.data?.message || err.message));
    } finally { setLoading(false); }
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <form onSubmit={handleSubmit} className="flex items-center gap-3 px-3 py-2 bg-[color:var(--bg-surface-1)] border-b border-black/30 shrink-0">
        <span className="text-[10px] text-[#f48771]">Date *</span>
        <input type="date" required value={date} onChange={e => setDate(e.target.value)}
          className="bg-[color:var(--bg-app)] border border-[#555] text-[color:var(--text-primary)] text-[11px] h-[22px] px-2 rounded-[2px] outline-none focus:border-[color:var(--accent-500)]" />
        <button type="submit" disabled={loading}
          className="flex items-center gap-1.5 h-[22px] px-3 bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-[11px] rounded-[2px] disabled:opacity-50">
          <Search size={11} /> {loading ? 'Loading…' : 'Load'}
        </button>
      </form>
      {loading
        ? <div className="flex items-center justify-center flex-1 text-white text-[11px]">Loading…</div>
        : data
          ? renderResult(data)
          : <div className="flex items-center justify-center flex-1 text-white text-[11px]">Select a date and click Load.</div>}
    </div>
  );
};

// ─── Generate Report ─────────────────────────────────────────────────────────
const GenerateReportTab = () => {
  const [type, setType] = useState('emir');
  const [from, setFrom] = useState(yesterday());
  const [to, setTo] = useState(today());
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await ReportsService.generateTransactionReport(type, from, to);
      setResult(res);
    } catch (err) {
      alert('Failed: ' + (err.response?.data?.message || err.message));
    } finally { setLoading(false); }
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <form onSubmit={handleSubmit} className="flex items-center gap-3 px-3 py-2 bg-[color:var(--bg-surface-1)] border-b border-black/30 shrink-0 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-[#f48771]">Type *</span>
          <select value={type} onChange={e => setType(e.target.value)}
            className="bg-[color:var(--bg-app)] border border-[#555] text-[color:var(--text-primary)] text-[11px] h-[22px] px-1.5 rounded-[2px] outline-none focus:border-[color:var(--accent-500)]">
            <option value="emir">EMIR</option>
            <option value="mifid">MiFID</option>
            <option value="aml">AML</option>
          </select>
        </div>
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
        <button type="submit" disabled={loading}
          className="flex items-center gap-1.5 h-[22px] px-3 bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-[11px] rounded-[2px] disabled:opacity-50">
          <Search size={11} /> {loading ? 'Generating…' : 'Generate'}
        </button>
      </form>
      <div className="flex-1 overflow-auto">
        {loading
          ? <div className="flex items-center justify-center h-24 text-white text-[11px]">Generating…</div>
          : result
            ? <KVCard data={result} title="Generated Report" />
            : <div className="flex items-center justify-center h-24 text-white text-[11px]">Fill in the fields and click Generate.</div>}
      </div>
    </div>
  );
};

// ─── Best Execution ──────────────────────────────────────────────────────────
const BestExecutionTab = () => {
  const [from, setFrom] = useState(yesterday());
  const [to, setTo] = useState(today());
  const [login, setLogin] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setData(null);
    try {
      const res = await ReportsService.getBestExecutionReport(from, to, login || undefined);
      setData(Array.isArray(res) ? res : [res]);
    } catch (err) {
      alert('Failed: ' + (err.response?.data?.message || err.message));
    } finally { setLoading(false); }
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <form onSubmit={handleSubmit} className="flex items-center gap-3 px-3 py-2 bg-[color:var(--bg-surface-1)] border-b border-black/30 shrink-0 flex-wrap">
        <span className="text-[10px] text-[#f48771]">From *</span>
        <input type="date" required value={from} onChange={e => setFrom(e.target.value)}
          className="bg-[color:var(--bg-app)] border border-[#555] text-[color:var(--text-primary)] text-[11px] h-[22px] px-2 rounded-[2px] outline-none focus:border-[color:var(--accent-500)]" />
        <span className="text-[10px] text-[#f48771]">To *</span>
        <input type="date" required value={to} onChange={e => setTo(e.target.value)}
          className="bg-[color:var(--bg-app)] border border-[#555] text-[color:var(--text-primary)] text-[11px] h-[22px] px-2 rounded-[2px] outline-none focus:border-[color:var(--accent-500)]" />
        <span className="text-[10px] text-white">Login</span>
        <input type="number" value={login} onChange={e => setLogin(e.target.value)} placeholder="Optional"
          className="bg-[color:var(--bg-app)] border border-[#555] text-[color:var(--text-primary)] text-[11px] h-[22px] px-2 w-28 rounded-[2px] outline-none focus:border-[color:var(--accent-500)]" />
        <button type="submit" disabled={loading}
          className="flex items-center gap-1.5 h-[22px] px-3 bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-[11px] rounded-[2px] disabled:opacity-50">
          <Search size={11} /> {loading ? 'Loading…' : 'Load'}
        </button>
      </form>
      {loading
        ? <div className="flex items-center justify-center flex-1 text-white text-[11px]">Loading…</div>
        : data
          ? <DataTable data={data} />
          : <div className="flex items-center justify-center flex-1 text-white text-[11px]">Set date range and click Load.</div>}
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────
const RegulatoryReportsView = () => {
  const [tab, setTab] = useState('EMIR');

  return (
    <div className="flex-1 bg-[color:var(--bg-app)] flex flex-col overflow-hidden">
      <div className="flex items-center bg-[color:var(--bg-surface-1)] border-b border-black/40 shrink-0 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 h-[30px] text-[11px] border-r border-black/30 whitespace-nowrap transition-colors ${tab === t ? 'bg-[color:var(--bg-app)] text-[color:var(--text-primary)] border-t-2 border-t-[color:var(--accent-500)]' : 'text-white hover:text-white'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'EMIR' && (
        <DateRangeReport onLoad={(f, t) => ReportsService.getTradeReportEMIR(f, t)} />
      )}
      {tab === 'MiFID' && (
        <DateRangeReport onLoad={(f, t) => ReportsService.getTradeReportMiFID(f, t)} />
      )}
      {tab === 'Reconciliation' && (
        <SingleDateReport
          onLoad={(d) => ReportsService.getClientMoneyReconciliation(d)}
          renderResult={(data) => (
            <div className="flex-1 overflow-auto">
              <KVCard data={data} title="Client Money Reconciliation" />
            </div>
          )}
        />
      )}
      {tab === 'Daily Transactions' && (
        <SingleDateReport
          onLoad={(d) => ReportsService.getTransactionReportDaily(d)}
          renderResult={(data) => <DataTable data={Array.isArray(data) ? data : [data]} />}
        />
      )}
      {tab === 'Generate Report' && <GenerateReportTab />}
      {tab === 'Best Execution' && <BestExecutionTab />}
    </div>
  );
};

export default RegulatoryReportsView;
