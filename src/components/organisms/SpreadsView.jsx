import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, Loader2, Plus, Search, Trash2, X } from 'lucide-react';
import { ManagerService } from '../../services/manager.service';
import CreateSpreadSchedulePopup from '../popups/CreateSpreadSchedulePopup';
import LpSymbolDatalist from '../atoms/LpSymbolDatalist';
import { getApiErrorMessage } from '../../utils/apiShapes';
import './SpreadsView.css';

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const SpreadsView = ({ refreshTrigger = 0 }) => {
  const [symbol, setSymbol] = useState('');
  const [searchedSymbol, setSearchedSymbol] = useState('');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isAddPopupOpen, setIsAddPopupOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState({ visible: false });
  const searchRef = useRef(null);
  const previousRefresh = useRef(refreshTrigger);
  const requestId = useRef(0);

  const fetchSchedules = useCallback(async (sym) => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError('');
    setData([]);
    try {
      const res = await ManagerService.getSpreadScheduleList(sym);
      if (currentRequest !== requestId.current) return;
      setData(Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      if (currentRequest === requestId.current) setError(getApiErrorMessage(err, 'Unable to load spread schedules.'));
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (previousRefresh.current === refreshTrigger) return;
    previousRefresh.current = refreshTrigger;
    if (searchedSymbol) fetchSchedules(searchedSymbol);
  }, [refreshTrigger, searchedSymbol, fetchSchedules]);

  useEffect(() => {
    if (!contextMenu.visible) return;
    const dismiss = event => { if (event.key === 'Escape') setContextMenu({ visible: false }); };
    window.addEventListener('keydown', dismiss);
    return () => window.removeEventListener('keydown', dismiss);
  }, [contextMenu.visible]);

  const handleSearch = event => {
    event.preventDefault();
    if (!symbol.trim() || loading) return;
    const nextSymbol = symbol.trim();
    setSearchedSymbol(nextSymbol);
    fetchSchedules(nextSymbol);
  };

  const handleContextMenu = (event, row) => {
    event.preventDefault();
    setContextMenu({ visible: true, x: Math.min(event.clientX, window.innerWidth - 184), y: Math.min(event.clientY, window.innerHeight - 84), row });
  };

  const handleDelete = async row => {
    setContextMenu({ visible: false });
    if (!row || !window.confirm(`Delete spread schedule ID ${row.id}?`)) return;
    try {
      await ManagerService.deleteSpreadSchedule(row.id);
      fetchSchedules(searchedSymbol);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to delete spread schedule.'));
    }
  };

  return (
    <section className="spreads-view" aria-label="Spreads workspace" onClick={() => setContextMenu({ visible: false })}>
      <header className="spreads-heading">
        <h1><Activity size={13} aria-hidden="true" />Spreads</h1>
        {searchedSymbol && !loading && !error && <span className="spreads-count">{data.length} {data.length === 1 ? 'schedule' : 'schedules'}</span>}
        <div className="spreads-toolbar">
          <form onSubmit={handleSearch} className="spreads-lookup">
            <div className="spreads-search">
              <Search size={13} aria-hidden="true" />
              <input ref={searchRef} type="text" aria-label="Symbol for spread schedules" value={symbol} onChange={event => setSymbol(event.target.value)} placeholder="Enter a symbol…" list="spreads-symbol-options" autoComplete="off" spellCheck={false} />
              {symbol && <button type="button" className="spreads-clear" aria-label="Clear symbol input" onClick={() => { setSymbol(''); searchRef.current?.focus(); }}><X size={12} aria-hidden="true" /></button>}
              <LpSymbolDatalist id="spreads-symbol-options" />
            </div>
            <button type="submit" className="spreads-button" disabled={!symbol.trim() || loading}>{loading ? 'Loading…' : 'Load'}</button>
          </form>
          <button type="button" className="spreads-button is-primary" onClick={() => setIsAddPopupOpen(true)}><Plus size={13} aria-hidden="true" />Add Schedule</button>
        </div>
      </header>
      {error && <div className="spreads-notice" role="alert"><span>{error}</span><button type="button" className="spreads-button" disabled={loading} onClick={() => fetchSchedules(searchedSymbol)}>Retry</button></div>}
      <div className="spreads-scroll" tabIndex={0} aria-label="Spread schedule grid">
        <table className="spreads-table" aria-label="Spread schedules" aria-busy={loading}>
          <colgroup><col className="spreads-col-id" /><col /><col className="spreads-col-group" /><col /><col /><col /><col className="spreads-col-override" /><col className="spreads-col-actions" /></colgroup>
          <thead><tr>{['ID', 'Symbol', 'Group', 'Day', 'Start time', 'End time', 'Spread override (pts)'].map(label => <th scope="col" key={label}>{label}</th>)}<th scope="col" className="spreads-actions">Actions</th></tr></thead>
          <tbody>{data.map((row, index) => <tr key={row.id ?? index} onContextMenu={event => handleContextMenu(event, row)}>
            <td className="spreads-id">{row.id ?? '—'}</td>
            <td className="spreads-symbol" title={row.symbol}>{row.symbol || '—'}</td>
            <td title={row.group_name}>{row.group_name || '—'}</td>
            <td>{DAY_LABELS[row.day_of_week] ?? row.day_of_week ?? '—'}</td>
            <td className="spreads-time">{row.time_from ?? '—'}</td>
            <td className="spreads-time">{row.time_to ?? '—'}</td>
            <td className="spreads-number">{row.spread_override ?? '—'}</td>
            <td className="spreads-actions"><button type="button" className="spreads-row-action" aria-label={`Delete schedule ${row.id}`} title="Delete schedule" onClick={() => handleDelete(row)}><Trash2 size={13} aria-hidden="true" /></button></td>
          </tr>)}</tbody>
        </table>
        {!data.length && !error && <div className="spreads-empty" role="status">
          <span className="spreads-empty-icon">{loading ? <Loader2 size={18} className="spreads-spin" aria-hidden="true" /> : <Activity size={18} aria-hidden="true" />}</span>
          <strong>{loading ? 'Loading spread schedules…' : searchedSymbol ? 'No spread schedules found' : 'Load spread schedules'}</strong>
          <p>{loading ? `Retrieving schedules for ${searchedSymbol}.` : searchedSymbol ? `No schedules are configured for ${searchedSymbol}. Add a schedule or load another symbol.` : 'Enter a symbol and select Load to view its scheduled spread overrides.'}</p>
        </div>}
      </div>
      <footer className="spreads-footer">
        <span className="spreads-footer-tab">Spreads</span>
        <span className="spreads-footer-summary" role="status">{searchedSymbol && <strong>{searchedSymbol}</strong>}<span>{loading ? 'Loading…' : error ? 'Request failed' : searchedSymbol ? `${data.length} ${data.length === 1 ? 'schedule' : 'schedules'}` : 'No symbol loaded'}</span></span>
      </footer>
      {isAddPopupOpen && <CreateSpreadSchedulePopup initialSymbol={searchedSymbol} onClose={() => setIsAddPopupOpen(false)} onCreated={() => searchedSymbol && fetchSchedules(searchedSymbol)} />}
      {contextMenu.visible && <div className="spreads-context" style={{ top: contextMenu.y, left: contextMenu.x }} onClick={event => event.stopPropagation()}>
        <button type="button" onClick={() => { setIsAddPopupOpen(true); setContextMenu({ visible: false }); }}><Plus size={13} aria-hidden="true" />Add Schedule</button>
        <button type="button" className="is-danger" onClick={() => handleDelete(contextMenu.row)}><Trash2 size={13} aria-hidden="true" />Delete Schedule</button>
      </div>}
    </section>
  );
};

export default SpreadsView;
