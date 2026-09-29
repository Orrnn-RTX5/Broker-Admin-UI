import React, { useCallback, useState, useEffect } from 'react';
import { PaymentService } from '../../services/payment.service';
import { Plus, RefreshCw, X, Edit2, Check } from 'lucide-react';

const fmt = (v) => (v == null ? '—' : v);
const fmtTs = (v) => { if (!v) return '—'; try { return new Date(v * 1000).toLocaleDateString(); } catch { return v; } };

const STATUS_COLORS = { true: 'text-white', false: 'text-[#f48771]' };
const TYPE_COLORS = { wire: '#9cdcfe', card: 'var(--success-500)', crypto: '#f4c96e', ewallet: '#ce9178' };

// ── Add / Edit Popup ───────────────────────────────────────────────────────
const MethodPopup = ({ initial, onClose, onSaved }) => {
  const editing = !!initial;
  const [form, setForm] = useState(initial ? {
    id: initial.id, name: initial.name, method_type: initial.method_type,
    currency: initial.currency, min_amount: initial.min_amount ?? '',
    max_amount: initial.max_amount ?? '', fee_fixed: initial.fee_fixed ?? '',
    fee_percent: initial.fee_percent ?? '', processing_time: initial.processing_time ?? '',
    enabled: initial.enabled,
  } : { name: '', method_type: 'wire', currency: 'USD', min_amount: '', max_amount: '', fee_fixed: '', fee_percent: '', processing_time: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Name is required.'); return; }
    if (!form.method_type) { setError('Method type is required.'); return; }
    setLoading(true); setError('');
    try {
      const payload = { ...form };
      ['min_amount','max_amount','fee_fixed','fee_percent'].forEach(k => { if (payload[k] !== '') payload[k] = parseFloat(payload[k]); else delete payload[k]; });
      if (!editing) { delete payload.id; delete payload.enabled; }
      if (editing) await PaymentService.updateMethod(payload);
      else await PaymentService.createMethod(payload);
      onSaved(); onClose();
    } catch (err) { setError(err.response?.data?.message || err.message); }
    finally { setLoading(false); }
  };

  const inp = "w-full bg-[color:var(--bg-surface-2)] border border-[#555] text-[color:var(--text-primary)] text-[12px] px-2 py-1 rounded-[2px] focus:outline-none focus:border-[color:var(--accent-500)]";
  const Lbl = ({ t, req, children }) => (
    <div className="flex flex-col gap-0.5">
      <label className="text-[10px] text-white uppercase tracking-wider">{t}{req && <span className="text-[#f48771] ml-0.5">*</span>}</label>
      {children}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-[color:var(--bg-surface-1)] border border-[color:var(--border-default)] rounded-[3px] shadow-2xl w-[460px]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center h-9 px-4 border-b border-black/40 bg-[color:var(--bg-surface-1)]">
          <span className="text-[12px] font-semibold text-[color:var(--text-primary)] flex-1">{editing ? 'Edit Payment Method' : 'Add Payment Method'}</span>
          <button onClick={onClose} className="text-white hover:text-white"><X size={14} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Lbl t="Name" req><input className={inp} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Bank Wire" /></Lbl>
            <Lbl t="Method Type" req>
              <select className={inp} value={form.method_type} onChange={e => set('method_type', e.target.value)}>
                {['wire','card','crypto','ewallet'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Lbl>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Lbl t="Currency"><input className={inp} value={form.currency} onChange={e => set('currency', e.target.value)} placeholder="USD" /></Lbl>
            <Lbl t="Min Amount"><input className={inp} type="number" step="0.01" value={form.min_amount} onChange={e => set('min_amount', e.target.value)} placeholder="0" /></Lbl>
            <Lbl t="Max Amount"><input className={inp} type="number" step="0.01" value={form.max_amount} onChange={e => set('max_amount', e.target.value)} placeholder="0=unlimited" /></Lbl>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Lbl t="Fee Fixed"><input className={inp} type="number" step="0.01" value={form.fee_fixed} onChange={e => set('fee_fixed', e.target.value)} placeholder="0" /></Lbl>
            <Lbl t="Fee %"><input className={inp} type="number" step="0.01" value={form.fee_percent} onChange={e => set('fee_percent', e.target.value)} placeholder="0" /></Lbl>
            <Lbl t="Processing Time"><input className={inp} value={form.processing_time} onChange={e => set('processing_time', e.target.value)} placeholder="instant" /></Lbl>
          </div>
          {editing && (
            <div className="flex items-center gap-2">
              <input type="checkbox" id="enabled" checked={!!form.enabled} onChange={e => set('enabled', e.target.checked)} className="accent-[color:var(--accent-500)]" />
              <label htmlFor="enabled" className="text-[11px] text-white">Enabled</label>
            </div>
          )}
          {error && <div className="text-[11px] text-[#f48771] bg-[color:var(--bg-surface-2)] px-3 py-1.5 rounded-[2px]">{error}</div>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="h-[26px] px-4 text-[11px] bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--border-strong)] text-white rounded-[2px]">Cancel</button>
            <button type="submit" disabled={loading} className="h-[26px] px-4 text-[11px] bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] disabled:opacity-50 text-white rounded-[2px]">{loading ? 'Saving…' : editing ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Main View ──────────────────────────────────────────────────────────────
const PaymentMethodsView = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [filterEnabled, setFilterEnabled] = useState('');
  const [filterCurrency, setFilterCurrency] = useState('');
  const [popup, setPopup] = useState(null); // null | 'add' | row (edit)
  const [contextMenu, setContextMenu] = useState({ visible: false });

  const loadMethods = useCallback(async ({ enabled, currency }) => {
    setLoading(true);
    setLoadError('');
    try {
      const params = {};
      if (enabled !== '') params.enabled = enabled === 'true';
      if (currency) params.currency = currency;
      const res = await PaymentService.getMethodList(params);
      setData(Array.isArray(res) ? res : res?.data ?? []);
    } catch (err) {
      setData([]);
      setLoadError(err?.response?.status === 403
        ? 'Access to payment methods was denied. Check this account’s permissions and try again.'
        : 'Payment methods could not be loaded. Try refreshing this view.');
    }
    finally { setLoading(false); }
  }, []);

  const fetchData = useCallback(() => {
    return loadMethods({ enabled: filterEnabled, currency: filterCurrency });
  }, [filterCurrency, filterEnabled, loadMethods]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      loadMethods({ enabled: '', currency: '' });
    }, 0);
    return () => window.clearTimeout(timerId);
  }, [loadMethods]);

  const handleDelete = async () => {
    const row = contextMenu.row;
    if (!row || !window.confirm(`Disable method "${row.name}" (ID: ${row.id})?`)) return;
    try { await PaymentService.deleteMethod(row.id); fetchData(); }
    catch (err) { alert(err.response?.data?.message || err.message); }
    setContextMenu({ visible: false });
  };

  const cols = [
    { label: 'ID', w: 'w-[60px]' }, { label: 'Name', w: 'w-[160px]' },
    { label: 'Type', w: 'w-[120px]' }, { label: 'Currency', w: 'w-[90px]' },
    { label: 'Min', w: 'w-[90px]' }, { label: 'Max', w: 'w-[90px]' },
    { label: 'Fee Fixed', w: 'w-[90px]' }, { label: 'Fee %', w: 'w-[80px]' },
    { label: 'Processing', w: 'w-[120px]' }, { label: 'Enabled', w: 'w-[80px]' },
    { label: 'Created', w: 'flex-1' },
  ];
  const clippedTextClassName = 'block min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap';

  return (
    <div className="flex-1 bg-[color:var(--bg-app)] flex flex-col overflow-hidden relative"
      onClick={() => setContextMenu({ visible: false })} onContextMenu={e => e.preventDefault()}>
      {/* Action Bar */}
      <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap px-2 py-1.5 bg-[color:var(--bg-surface-1)] border-b border-[color:var(--border-default)] shrink-0 select-none">
        <button type="button" onClick={() => setPopup('add')}
          className="flex shrink-0 items-center gap-1.5 h-[24px] px-3 bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-[11px] rounded-[2px] transition-colors">
          <Plus size={12} /> Add Method
        </button>
        <div className="flex shrink-0 items-center gap-1.5 sm:ml-3">
          <select value={filterEnabled} onChange={e => setFilterEnabled(e.target.value)}
            className="h-[22px] bg-[color:var(--bg-surface-2)] border border-[#555] text-white text-[11px] px-2 rounded-[2px] focus:outline-none focus:border-[color:var(--accent-500)]">
            <option value="">All status</option>
            <option value="true">Enabled</option>
            <option value="false">Disabled</option>
          </select>
          <input value={filterCurrency} onChange={e => setFilterCurrency(e.target.value)}
            placeholder="currency…" onKeyDown={e => e.key === 'Enter' && fetchData()}
            className="h-[22px] w-[100px] bg-[color:var(--bg-surface-2)] border border-[#555] text-[color:var(--text-primary)] text-[11px] px-2 rounded-[2px] focus:outline-none focus:border-[color:var(--accent-500)]" />
          <button onClick={fetchData} className="h-[22px] px-2.5 bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--border-strong)] text-white text-[11px] rounded-[2px] border border-[#555]">Filter</button>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2 pr-2">
          <button type="button" onClick={fetchData} title="Refresh" aria-label="Refresh payment methods" className="text-[color:var(--text-secondary)] hover:text-white"><RefreshCw size={13} /></button>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-auto no-scrollbar" aria-busy={loading}>
      <div className="w-full min-w-[1140px]">
      {/* Header and rows share horizontal scrolling. */}
      <div className="flex bg-[color:var(--bg-surface-2)] border-b border-[color:var(--border-default)] sticky top-0 z-10 select-none shrink-0">
        {cols.map(c => (
          <div
            key={c.label}
            className={`${c.w} px-3 py-1.5 text-[11px] font-semibold text-[color:var(--text-secondary)] border-r border-[color:var(--border-subtle)] shrink-0 min-w-0 overflow-hidden`}
            title={c.label}
          >
            <span className={clippedTextClassName}>{c.label}</span>
          </div>
        ))}
      </div>
      {/* Body */}
        {data.map((row, idx) => (
          <div key={row.id || idx} onContextMenu={e => { e.preventDefault(); setContextMenu({ visible: true, x: e.clientX, y: e.clientY, row }); }}
            className={`group flex border-b border-[color:var(--border-subtle)] hover:bg-[color:var(--bg-surface-3)] transition-colors cursor-default ${idx % 2 === 0 ? 'bg-[color:var(--bg-app)]' : 'bg-[color:var(--bg-surface-1)]'}`}>
            <div className="w-[60px] px-3 py-1 text-[12px] text-white font-semibold border-r border-black/10 shrink-0 flex items-center">{fmt(row.id)}</div>
            <div className="w-[160px] px-3 py-1 text-[12px] text-[color:var(--text-primary)] border-r border-black/10 shrink-0 truncate flex items-center">{fmt(row.name)}</div>
            <div className="w-[120px] px-3 py-1 text-[12px] border-r border-black/10 shrink-0 flex items-center min-w-0 overflow-hidden" title={fmt(row.method_type)}>
              <span className={`${clippedTextClassName} font-mono text-[11px] px-1.5 py-0.5 rounded-[2px] bg-black/30`} style={{ color: TYPE_COLORS[row.method_type] || '#ccc' }}>{fmt(row.method_type)}</span>
            </div>
            <div className="w-[90px] px-3 py-1 text-[12px] text-[color:var(--text-secondary)] border-r border-black/10 shrink-0 flex items-center">{fmt(row.currency)}</div>
            <div className="w-[90px] px-3 py-1 text-[12px] text-[color:var(--text-secondary)] border-r border-black/10 shrink-0 flex items-center">{fmt(row.min_amount)}</div>
            <div className="w-[90px] px-3 py-1 text-[12px] text-[color:var(--text-secondary)] border-r border-black/10 shrink-0 flex items-center">{row.max_amount === 0 ? '∞' : fmt(row.max_amount)}</div>
            <div className="w-[90px] px-3 py-1 text-[12px] text-[color:var(--text-secondary)] border-r border-black/10 shrink-0 flex items-center">{fmt(row.fee_fixed)}</div>
            <div className="w-[80px] px-3 py-1 text-[12px] text-[color:var(--text-secondary)] border-r border-black/10 shrink-0 flex items-center">{row.fee_percent != null ? `${row.fee_percent}%` : '—'}</div>
            <div className="w-[120px] px-3 py-1 text-[12px] text-[color:var(--text-secondary)] border-r border-black/10 shrink-0 truncate flex items-center">{fmt(row.processing_time)}</div>
            <div className="w-[80px] px-3 py-1 text-[12px] border-r border-black/10 shrink-0 flex items-center">
              <span className={`text-[11px] font-semibold ${STATUS_COLORS[String(row.enabled)]}`}>{row.enabled ? 'Yes' : 'No'}</span>
            </div>
            <div className="flex-1 px-3 py-1 text-[11px] text-[color:var(--text-secondary)] font-mono flex items-center gap-2">
              {fmtTs(row.created_at)}
              <button onClick={e => { e.stopPropagation(); setPopup(row); }} title="Edit"
                className="ml-auto text-white hover:text-white opacity-0 group-hover:opacity-100 transition-colors">
                <Edit2 size={11} />
              </button>
            </div>
          </div>
        ))}
      </div>
        {loading && data.length === 0 && (
          <div role="status" className="flex min-h-40 items-center justify-center gap-2 px-6 text-[12px] text-[color:var(--text-secondary)]">
            <RefreshCw size={14} className="animate-spin text-white" />
            Loading payment methods…
          </div>
        )}
        {!loading && loadError && (
          <div role="alert" className="m-4 max-w-lg rounded-[var(--radius-md)] border border-[color:var(--danger-500)]/30 bg-[color:var(--danger-500)]/10 px-4 py-3 text-[12px] text-[color:var(--text-primary)]">
            {loadError}
            <button type="button" onClick={fetchData} className="ml-3 font-medium text-white hover:underline">Retry</button>
          </div>
        )}
        {!loading && !loadError && data.length === 0 && (
          <div className="flex min-h-44 flex-col items-center justify-center gap-2 px-6 text-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-md border border-[color:var(--border-default)] bg-[color:var(--bg-surface-2)] text-white">
              <Plus size={17} />
            </div>
            <p className="m-0 text-[13px] font-semibold text-[color:var(--text-primary)]">No payment methods found</p>
            <p className="m-0 text-[12px] text-[color:var(--text-secondary)]">Adjust the filters or add a payment method.</p>
            <button type="button" onClick={() => setPopup('add')} className="mt-2 inline-flex h-7 items-center gap-1.5 rounded-[3px] border border-[color:var(--border-strong)] bg-[color:var(--bg-surface-2)] px-3 text-[11px] text-[color:var(--text-primary)] hover:bg-[color:var(--bg-surface-3)]">
              <Plus size={12} /> Add Method
            </button>
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu.visible && (
        <div className="fixed z-[9999] bg-[color:var(--bg-surface-1)] border border-[color:var(--border-default)] shadow-2xl py-1 min-w-[180px] text-[12px] text-[color:var(--text-secondary)] rounded-[2px]"
          style={{ top: contextMenu.y, left: contextMenu.x }} onClick={e => e.stopPropagation()}>
          <div className="px-4 py-1 hover:bg-[color:var(--accent-500)] hover:text-white cursor-pointer" onClick={() => { setPopup(contextMenu.row); setContextMenu({ visible: false }); }}>Edit</div>
          <div className="px-4 py-1 hover:bg-[color:var(--accent-500)] hover:text-white cursor-pointer" onClick={() => { setPopup('add'); setContextMenu({ visible: false }); }}>Add Method</div>
          <div className="h-px bg-[color:var(--border-default)] my-1 mx-2"></div>
          <div className="px-4 py-1 hover:bg-[#e51400] hover:text-white cursor-pointer text-red-400" onClick={handleDelete}>Disable / Delete</div>
        </div>
      )}

      {popup && <MethodPopup initial={popup === 'add' ? null : popup} onClose={() => setPopup(null)} onSaved={fetchData} />}

      <div className="h-7 bg-[color:var(--bg-surface-1)] text-[color:var(--text-secondary)] flex items-center px-4 text-[11px] select-none shrink-0 border-t border-[color:var(--border-default)]">
        <span>Methods shown: <span className="font-semibold tabular-nums text-[color:var(--text-primary)]">{data.length}</span></span>
      </div>
    </div>
  );
};
export default PaymentMethodsView;
