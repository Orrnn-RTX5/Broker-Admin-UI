import React, { useEffect, useState } from 'react';
import { Pencil, RefreshCw, Save, Search, X } from 'lucide-react';
import { ServerConfigService } from '../../services/serverConfig.service';
import ActionableErrorState from '../atoms/ActionableErrorState';
import LpSymbolDatalist from '../atoms/LpSymbolDatalist';
import { getApiErrorMessage } from '../../utils/apiShapes';
import './ServerConfigTables.css';

const displayValue = (value) => {
  if (value == null) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const InlineMessage = ({ message, type = 'error', onDismiss }) => message && (
  <div className={`server-config-table-message server-config-table-message--${type}`} role={type === 'error' ? 'alert' : 'status'}>
    <span>{message}</span>
    {onDismiss && <button type="button" aria-label="Dismiss message" onClick={onDismiss}><X size={12} /></button>}
  </div>
);

const EmptyState = ({ title, detail }) => (
  <div className="server-config-table-empty">
    <strong>{title}</strong>
    <span>{detail}</span>
  </div>
);

const TableHeader = ({ title, description, count, loading, onRefresh, searchLabel, searchPlaceholder, searchValue, onSearchChange, onSearch, searching, searchListId, compact = false, onClearSearch }) => (
  <>
    {!compact && <div className="server-config-table-heading">
      <div className="server-config-table-heading-copy">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <span className="server-config-table-count">{count} {count === 1 ? 'record' : 'records'}</span>
    </div>}
    <div className="server-config-table-toolbar">
      <form className="server-config-table-search" onSubmit={onSearch}>
        <label className={compact ? 'sr-only' : undefined} htmlFor={`server-config-table-search-${searchLabel}`}>{searchLabel}</label>
        <div className="server-config-table-search-field">
          <Search size={13} aria-hidden="true" />
          <input
            id={`server-config-table-search-${searchLabel}`}
            value={searchValue}
            onChange={onSearchChange}
            placeholder={searchPlaceholder}
            list={searchListId}
            autoComplete="off"
            spellCheck={false}
          />
          {onClearSearch && searchValue && <button type="button" className="server-settings-clear" aria-label="Clear setting lookup" onClick={onClearSearch} disabled={searching}><X size={12} aria-hidden="true" /></button>}
          {searchListId && <LpSymbolDatalist id={searchListId} />}
        </div>
        <button type="submit" className="server-config-table-button server-config-table-button--primary" disabled={searching || !searchValue.trim()}>
          {searching ? 'Looking up…' : 'Find'}
        </button>
      </form>
      <button type="button" onClick={onRefresh} disabled={loading} className="server-config-table-button server-config-table-button--secondary">
        <RefreshCw size={12} aria-hidden="true" className={loading ? 'server-config-table-spin' : ''} />
        Refresh
      </button>
    </div>
  </>
);

export const ServerSettingsTab = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchKey, setSearchKey] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [editKey, setEditKey] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [notice, setNotice] = useState('');

  const loadAll = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const result = await ServerConfigService.listServerSettings();
      setData(Array.isArray(result) ? result : []);
    } catch (error) {
      setData([]);
      setLoadError(getApiErrorMessage(error, 'Server settings failed to load.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const handleSearch = async (event) => {
    event.preventDefault();
    const key = searchKey.trim();
    if (!key) return;
    setSearching(true);
    setSearchError('');
    setSearchResult(null);
    try {
      setSearchResult(await ServerConfigService.getServerSetting(key));
    } catch (error) {
      setSearchError(getApiErrorMessage(error, `Could not find setting “${key}”.`));
    } finally {
      setSearching(false);
    }
  };

  const beginEdit = (row) => {
    setEditKey(row.key);
    setEditValue(row.value == null ? '' : String(row.value));
    setSaveError('');
    setNotice('');
  };

  const cancelEdit = () => {
    setEditKey(null);
    setSaveError('');
  };

  const handleSave = async (key) => {
    if (saving) return;
    setSaving(true);
    setSaveError('');
    try {
      await ServerConfigService.setServerSetting(key, editValue);
      setData((rows) => rows.map((row) => row.key === key ? { ...row, value: editValue } : row));
      setSearchResult((result) => result?.key === key ? { ...result, value: editValue } : result);
      setEditKey(null);
      setNotice(`Saved ${key}.`);
    } catch (error) {
      setSaveError(getApiErrorMessage(error, `Could not save ${key}.`));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="server-config-table-view server-config-table-view--settings" aria-label="Server settings">
      <TableHeader
        compact
        title="Server Settings"
        loading={loading}
        onRefresh={loadAll}
        searchLabel="Setting key"
        searchPlaceholder="Find an exact key"
        searchValue={searchKey}
        onSearchChange={(event) => { setSearchKey(event.target.value); setSearchResult(null); setSearchError(''); }}
        onSearch={handleSearch}
        searching={searching}
        onClearSearch={() => { setSearchKey(''); setSearchResult(null); setSearchError(''); }}
      />
      <InlineMessage message={searchError} onDismiss={() => setSearchError('')} />
      <InlineMessage message={notice} type="success" onDismiss={() => setNotice('')} />
      {searchResult && (
        <div className="server-config-table-lookup" role="status">
          <span className="server-config-table-lookup-label">Lookup result</span>
          <strong title={displayValue(searchResult.key ?? searchKey)}>{displayValue(searchResult.key ?? searchKey)}</strong>
          <code title={displayValue(searchResult.value)}>{displayValue(searchResult.value)}</code>
          <button type="button" onClick={() => setSearchResult(null)} aria-label="Close lookup result"><X size={13} /></button>
        </div>
      )}
      <div className="server-config-table-scroll" role="region" aria-label="Server settings table" tabIndex={0}>
        {loadError ? <ActionableErrorState title="Unable to load settings" message={loadError} actionLabel="Retry" onAction={loadAll} compact />
          : loading && data.length === 0 ? <EmptyState title="Loading settings…" detail="Retrieving current server parameters." />
            : data.length === 0 ? <EmptyState title="No settings found" detail="Refresh to check for newly available settings." />
              : (
                <table className="server-config-table-grid server-config-table-grid--settings">
                  <caption className="sr-only">Server settings and their current values</caption>
                  <thead><tr><th scope="col">Setting key</th><th scope="col">Current value</th><th scope="col">Actions</th></tr></thead>
                  <tbody>
                    {data.map((row) => {
                      const editing = editKey === row.key;
                      return (
                        <React.Fragment key={row.key}>
                          <tr className={editing ? 'server-config-table-row--editing' : ''}>
                            <td><code className="server-config-table-key" title={displayValue(row.key)}>{displayValue(row.key)}</code></td>
                            <td>
                              {editing ? (
                                <input
                                  className="server-config-table-edit-input"
                                  autoFocus
                                  aria-label={`Value for ${row.key}`}
                                  value={editValue}
                                  onChange={(event) => setEditValue(event.target.value)}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter') handleSave(row.key);
                                    if (event.key === 'Escape') cancelEdit();
                                  }}
                                  disabled={saving}
                                />
                              ) : <code className="server-config-table-value" title={displayValue(row.value)}>{displayValue(row.value)}</code>}
                            </td>
                            <td className="server-config-table-action-cell">
                              {editing ? (
                                <div className="server-config-table-actions">
                                  <button type="button" className="server-config-table-button server-config-table-button--primary" onClick={() => handleSave(row.key)} disabled={saving}><Save size={12} />{saving ? 'Saving…' : 'Save'}</button>
                                  <button type="button" className="server-config-table-button server-config-table-button--quiet" onClick={cancelEdit} disabled={saving}>Cancel</button>
                                </div>
                              ) : (
                                <button type="button" className="server-config-table-button server-config-table-button--quiet" aria-label={`Edit setting ${row.key}`} onClick={() => beginEdit(row)} disabled={saving}><Pencil size={12} aria-hidden="true" />Edit</button>
                              )}
                            </td>
                          </tr>
                          {editing && saveError && <tr className="server-config-table-feedback-row"><td colSpan={3}><InlineMessage message={saveError} /></td></tr>}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              )}
      </div>
      <div className="server-config-table-footer"><span>{data.length} {data.length === 1 ? 'setting' : 'settings'}</span></div>
    </section>
  );
};

const parseSwapInput = (input) => {
  const text = input.trim();
  if (text === '') return { value: null };
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)) return { error: 'Enter a valid number.' };
  const value = Number(text);
  return Number.isFinite(value) ? { value } : { error: 'Enter a finite number.' };
};

const SwapValue = ({ value }) => {
  const numeric = Number(value);
  const tone = value == null || value === '' || !Number.isFinite(numeric) || numeric === 0
    ? 'neutral' : numeric > 0 ? 'positive' : 'negative';
  return <code className={`server-config-table-swap server-config-table-swap--${tone}`}>{displayValue(value)}</code>;
};

export const SwapRatesTab = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [symbolSearch, setSymbolSearch] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [editRow, setEditRow] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [notice, setNotice] = useState('');

  const loadAll = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const result = await ServerConfigService.listSwapRates();
      setData(Array.isArray(result) ? result : []);
    } catch (error) {
      setData([]);
      setLoadError(getApiErrorMessage(error, 'Swap rates failed to load.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const handleSearch = async (event) => {
    event.preventDefault();
    const symbol = symbolSearch.trim().toUpperCase();
    if (!symbol) return;
    setSearching(true);
    setSearchError('');
    setSearchResult(null);
    try {
      setSearchResult(await ServerConfigService.getSwapRate(symbol));
    } catch (error) {
      setSearchError(getApiErrorMessage(error, `Could not find swap rate for ${symbol}.`));
    } finally {
      setSearching(false);
    }
  };

  const beginEdit = (row) => {
    setEditRow({
      symbol: row.symbol,
      long: row.swap_long == null ? '' : String(row.swap_long),
      short: row.swap_short == null ? '' : String(row.swap_short),
    });
    setSaveError('');
    setFieldError('');
    setNotice('');
  };

  const cancelEdit = () => {
    setEditRow(null);
    setSaveError('');
    setFieldError('');
  };

  const handleSave = async () => {
    if (!editRow || saving) return;
    const long = parseSwapInput(editRow.long);
    const short = parseSwapInput(editRow.short);
    if (long.error || short.error) {
      setFieldError(`Swap ${long.error ? 'Long' : 'Short'}: ${long.error || short.error}`);
      return;
    }
    if (long.value == null && short.value == null) {
      setFieldError('Enter at least one rate to save. Blank fields leave the current rate unchanged.');
      return;
    }
    setSaving(true);
    setSaveError('');
    setFieldError('');
    try {
      await ServerConfigService.setSwapRate(editRow.symbol, long.value, short.value);
      const update = (row) => row?.symbol === editRow.symbol ? {
        ...row,
        ...(long.value != null ? { swap_long: long.value } : {}),
        ...(short.value != null ? { swap_short: short.value } : {}),
      } : row;
      setData((rows) => rows.map(update));
      setSearchResult((result) => result ? update(result) : result);
      setNotice(`Saved swap rates for ${editRow.symbol}.`);
      setEditRow(null);
    } catch (error) {
      setSaveError(getApiErrorMessage(error, `Could not save swap rates for ${editRow.symbol}.`));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="server-config-table-view" aria-label="Swap rates">
      <TableHeader
        title="Swap Rates"
        description="Inspect and maintain overnight financing by symbol."
        count={data.length}
        loading={loading}
        onRefresh={loadAll}
        searchLabel="Symbol"
        searchPlaceholder="Find an exact symbol"
        searchListId="swap-rate-symbol-options"
        searchValue={symbolSearch}
        onSearchChange={(event) => { setSymbolSearch(event.target.value); setSearchResult(null); setSearchError(''); }}
        onSearch={handleSearch}
        searching={searching}
      />
      <InlineMessage message={searchError} onDismiss={() => setSearchError('')} />
      <InlineMessage message={notice} type="success" onDismiss={() => setNotice('')} />
      {searchResult && (
        <div className="server-config-table-lookup server-config-table-lookup--swap" role="status">
          <span className="server-config-table-lookup-label">Lookup result</span>
          <strong>{displayValue(searchResult.symbol ?? symbolSearch.trim().toUpperCase())}</strong>
          <span>Long <SwapValue value={searchResult.swap_long} /></span>
          <span>Short <SwapValue value={searchResult.swap_short} /></span>
          <button type="button" onClick={() => setSearchResult(null)} aria-label="Close lookup result"><X size={13} /></button>
        </div>
      )}
      <div className="server-config-table-scroll">
        {loadError ? <ActionableErrorState title="Unable to load swap rates" message={loadError} actionLabel="Retry" onAction={loadAll} compact />
          : loading && data.length === 0 ? <EmptyState title="Loading swap rates…" detail="Retrieving current financing values." />
            : data.length === 0 ? <EmptyState title="No swap rates found" detail="Refresh to check for newly available symbols." />
              : (
                <table className="server-config-table-grid server-config-table-grid--swaps">
                  <thead><tr><th scope="col">Symbol</th><th scope="col">Swap long</th><th scope="col">Swap short</th><th scope="col">Triple rollover</th><th scope="col">Action</th></tr></thead>
                  <tbody>
                    {data.map((row) => {
                      const editing = editRow?.symbol === row.symbol;
                      return (
                        <React.Fragment key={row.symbol}>
                          <tr className={editing ? 'server-config-table-row--editing' : ''}>
                            <td><code className="server-config-table-key">{displayValue(row.symbol)}</code></td>
                            <td>
                              {editing ? <input
                                className="server-config-table-edit-input server-config-table-edit-input--numeric"
                                autoFocus
                                inputMode="decimal"
                                aria-label={`Swap long for ${row.symbol}`}
                                aria-invalid={Boolean(fieldError && parseSwapInput(editRow.long).error)}
                                value={editRow.long}
                                onChange={(event) => { setEditRow((current) => ({ ...current, long: event.target.value })); setFieldError(''); }}
                                onKeyDown={(event) => { if (event.key === 'Enter') handleSave(); if (event.key === 'Escape') cancelEdit(); }}
                                disabled={saving}
                              /> : <SwapValue value={row.swap_long} />}
                            </td>
                            <td>
                              {editing ? <input
                                className="server-config-table-edit-input server-config-table-edit-input--numeric"
                                inputMode="decimal"
                                aria-label={`Swap short for ${row.symbol}`}
                                aria-invalid={Boolean(fieldError && parseSwapInput(editRow.short).error)}
                                value={editRow.short}
                                onChange={(event) => { setEditRow((current) => ({ ...current, short: event.target.value })); setFieldError(''); }}
                                onKeyDown={(event) => { if (event.key === 'Enter') handleSave(); if (event.key === 'Escape') cancelEdit(); }}
                                disabled={saving}
                              /> : <SwapValue value={row.swap_short} />}
                            </td>
                            <td><span className="server-config-table-rollover">{displayValue(row.swap_rollover_3days)}</span></td>
                            <td className="server-config-table-action-cell">
                              {editing ? (
                                <div className="server-config-table-actions">
                                  <button type="button" className="server-config-table-button server-config-table-button--primary" onClick={handleSave} disabled={saving}><Save size={12} />{saving ? 'Saving…' : 'Save'}</button>
                                  <button type="button" className="server-config-table-button server-config-table-button--quiet" onClick={cancelEdit} disabled={saving}>Cancel</button>
                                </div>
                              ) : (
                                <button type="button" className="server-config-table-button server-config-table-button--quiet" onClick={() => beginEdit(row)} disabled={saving}><Pencil size={12} />Edit</button>
                              )}
                            </td>
                          </tr>
                          {editing && (fieldError || saveError) && <tr className="server-config-table-feedback-row"><td colSpan={5}><InlineMessage message={fieldError || saveError} /></td></tr>}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              )}
      </div>
      <div className="server-config-table-footer"><span>{data.length} {data.length === 1 ? 'symbol' : 'symbols'}</span></div>
    </section>
  );
};
