import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Radio, RefreshCw, Search, WifiOff } from 'lucide-react';
import LPGroupFeedControls from './LPGroupFeedControls.jsx';
import { lpFeeds, matchingFeedSnapshot } from '../../services/lpFeeds.js';
import { useAuthStore } from '../../store/authStore.js';
import './lp-feeds.css';

const adminPermissions = { account: () => true, connection: () => true, group: () => true };
const DISCONNECTED = 'This LP is not connected, so no prices are available.';
const SOURCE_KEY = 'rtx5.admin.lpQuoteSource';
const rememberedSource = () => { try { return localStorage.getItem(SOURCE_KEY) || ''; } catch { return ''; } };
const rememberSource = value => { try { if (value) localStorage.setItem(SOURCE_KEY, value); else localStorage.removeItem(SOURCE_KEY); } catch { /* storage unavailable */ } };
const ageText = ms => { const seconds = Math.max(0, Math.floor((Date.now() - ms) / 1000)); return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m`; };

function CompactFeedNotice({ title, children, problem = false, loading = false, onRetry }) {
  const Icon = problem ? WifiOff : loading ? RefreshCw : Radio;
  return <div className={`lp-feed-notice${problem ? ' is-problem' : ''}`} role={problem ? 'alert' : 'status'}>
    <span className="lp-feed-notice-icon"><Icon size={19} aria-hidden="true" className={loading ? 'is-spinning' : undefined} /></span>
    <strong>{title}</strong>
    <p>{children}</p>
    {onRetry && <button type="button" onClick={onRetry}><RefreshCw size={12} aria-hidden="true" />Retry</button>}
  </div>;
}

export default function LPFeedsPanel({ compact = false }) {
  const session = useAuthStore(state => state.accessToken);
  return session ? <FeedWorkspace key={session} compact={compact} permissions={adminPermissions} /> : null;
}

function FeedWorkspace({ compact = false, permissions }) {
  const [feeds, setFeeds] = useState([]);
  const [source, setSource] = useState(() => compact ? rememberedSource() : '');
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');
  const [listLoading, setListLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [filter, setFilter] = useState('');
  const [account, setAccount] = useState('');
  const [loaded, setLoaded] = useState(null);
  const [accountError, setAccountError] = useState('');
  const [busy, setBusy] = useState(false);
  const accountGeneration = useRef(0);

  useEffect(() => () => { accountGeneration.current++; }, []);
  useEffect(() => {
    let disposed = false;
    setListLoading(true);
    setListError('');
    lpFeeds.list().then(value => { if (!disposed) setFeeds(value.feeds || []); })
      .catch(e => { if (!disposed) { setFeeds([]); setListError(e.message); } })
      .finally(() => { if (!disposed) setListLoading(false); });
    return () => { disposed = true; };
  }, [refresh]);
  useEffect(() => {
    let disposed = false;
    let timer;
    setSnapshot(null);
    setError('');
    if (!source) return () => {};
    const poll = async () => {
      try {
        const listing = await lpFeeds.list();
        if (disposed) return;
        setFeeds(listing.feeds || []);
        setListError('');
        const selected = listing.feeds?.find(feed => feed.source_id === source);
        if (!selected?.connected) throw new Error(DISCONNECTED);
        const [catalog, ticks] = await Promise.all([lpFeeds.catalog(source), lpFeeds.ticks(source)]);
        const next = matchingFeedSnapshot(source, catalog, ticks);
        if (next.revision !== selected.connection_revision) throw new Error('LP settings changed. Waiting for fresh prices.');
        if (!disposed) { setSnapshot(next); setError(''); }
      } catch (e) {
        if (!disposed) { setSnapshot(null); setError(e.message); }
      } finally {
        if (!disposed) timer = setTimeout(poll, 2000);
      }
    };
    poll();
    return () => { disposed = true; clearTimeout(timer); };
  }, [source, refresh]);

  const perform = async () => {
    const request = ++accountGeneration.current;
    setBusy(true); setAccountError('');
    try { const result = await lpFeeds.account(account.trim()); if (request === accountGeneration.current) setLoaded(result); }
    catch (e) { if (request === accountGeneration.current) { setAccountError(e.message); setLoaded(null); } }
    finally { if (request === accountGeneration.current) setBusy(false); }
  };
  const choose = value => { setSnapshot(null); setFilter(''); setSource(value); if (compact) rememberSource(value); };
  // Market Watch shows the only LP directly when there is nothing to choose.
  useEffect(() => { if (compact && !source && feeds.length === 1) choose(feeds[0].source_id); }, [compact, source, feeds]); // eslint-disable-line react-hooks/exhaustive-deps -- choose only sets state.

  const selected = feeds.find(feed => feed.source_id === source);
  const state = !source ? 'idle' : error ? 'down' : snapshot ? 'live' : 'loading';
  const query = filter.trim().toUpperCase();
  const rows = snapshot ? snapshot.catalog.filter(item => !query || item.symbol.toUpperCase().includes(query)) : [];
  const refreshSources = () => setRefresh(value => value + 1);
  return <section className={`lp-feeds-panel${compact ? ' is-compact' : ''}`} aria-label="LP quote feeds">
    <header className="lp-feeds-head">
      <div>{compact && <Radio size={14} className="lp-feeds-heading-icon" aria-hidden="true" />}<div><h2 className="lp-feeds-title">{compact ? 'Named feeds' : 'Live LP quotes'}</h2><p className="lp-feeds-intro">{compact ? 'Direct provider quotes' : 'Choose a provider to inspect the prices it is sending now. Quotes are shown exactly as received from that source.'}</p></div></div>
      <button className={compact ? 'lp-feeds-refresh' : undefined} type="button" aria-label="Refresh sources" title="Refresh sources" disabled={listLoading} onClick={refreshSources}>{compact ? <RefreshCw size={13} aria-hidden="true" className={listLoading ? 'is-spinning' : undefined} /> : listLoading ? 'Refreshing…' : 'Refresh sources'}</button>
    </header>
    <div className="lp-feeds-preview">
      <div className="lp-feeds-source-controls">
      <label className="lp-feeds-source">Quote source<span className="lp-feeds-select-wrap"><select value={source} onChange={event => choose(event.target.value)} disabled={compact && listLoading && !feeds.length}>
        <option value="">Choose an LP</option>
        {source && !selected && <option value={source}>{source} — unavailable</option>}
        {feeds.map(feed => <option key={feed.source_id} value={feed.source_id} title={feed.source_id}>{feed.name} — {feed.connected ? 'Connected' : 'Not connected'}</option>)}
      </select>{compact && <ChevronDown size={12} aria-hidden="true" />}</span></label>
      {compact && snapshot && <label className="lp-feeds-symbol-search"><Search size={12} aria-hidden="true" /><input aria-label="Search provider symbols" placeholder="Search symbols…" value={filter} onChange={event => setFilter(event.target.value)} /></label>}
      </div>
      {source && <p className={`lp-feed-status is-${state}`} role="status"><span className="lp-feed-dot" aria-hidden="true" />{compact ? state === 'live' ? 'Live quotes' : state === 'down' ? 'Prices unavailable' : 'Connecting…' : state === 'live' ? `Live · ${snapshot.catalog.length} symbol${snapshot.catalog.length === 1 ? '' : 's'} · updated ${ageText(snapshot.publishedAt)} ago` : state === 'down' ? 'Prices unavailable' : 'Loading prices…'}{compact && snapshot && <span className="lp-feed-symbol-count">{snapshot.catalog.length} symbol{snapshot.catalog.length === 1 ? '' : 's'}</span>}</p>}
      {compact ? <>
        {listLoading && !feeds.length && !source && <CompactFeedNotice title="Loading sources" loading>Fetching provider connections…</CompactFeedNotice>}
        {!listLoading && !feeds.length && !listError && !source && <CompactFeedNotice title="No quote sources">Create and enable an LP connection to view its quotes here.</CompactFeedNotice>}
        {listError && !source && <CompactFeedNotice title="Sources unavailable" problem onRetry={refreshSources}>{listError}</CompactFeedNotice>}
        {!listLoading && feeds.length > 0 && !source && <CompactFeedNotice title="Select a quote source">Choose a provider above to inspect its symbols and live prices.</CompactFeedNotice>}
        {source && !snapshot && !error && <CompactFeedNotice title="Waiting for quotes" loading>Retrieving prices from the selected provider…</CompactFeedNotice>}
        {source && error && <CompactFeedNotice title={selected && !selected.connected ? 'Provider disconnected' : 'Quotes unavailable'} problem onRetry={refreshSources}>{error}</CompactFeedNotice>}
      </> : <>
        {listLoading && !feeds.length && <p className="lp-feeds-note" role="status">Loading LP connections…</p>}
        {!listLoading && !feeds.length && !listError && <p className="lp-feeds-empty">No LP connections yet. Create and enable one in Connections to inspect its quotes.</p>}
        {listError && !source && <div className="lp-feed-problem" role="alert"><p>Could not load LP connections: {listError}</p><p>Use Refresh sources to try again.</p></div>}
        {source && error && <div className="lp-feed-problem" role="alert"><p>{error}</p>{selected && !selected.connected && <p>Check this provider’s connection status and settings in Connections, then run a logon test.</p>}</div>}
      </>}
      {snapshot && <>
        {!compact && <p className="lp-feeds-note">Source ID: {source} · connection revision {snapshot.revision} · published <time dateTime={new Date(snapshot.publishedAt).toISOString()} title={new Date(snapshot.publishedAt).toISOString()}>{new Date(snapshot.publishedAt).toLocaleString()}</time></p>}
        {!compact && snapshot.catalog.length > 8 && <label className="lp-feed-filter-label">Find a symbol<input className="lp-feed-filter" placeholder="Search symbols…" value={filter} onChange={event => setFilter(event.target.value)} /></label>}
        <div className="lp-feed-table" role="region" aria-label="Quotes for selected LP" tabIndex={0}><table><thead><tr><th scope="col">Symbol</th>{!compact && <th scope="col">Provider instrument</th>}<th scope="col" className="num">Bid</th><th scope="col" className="num">Ask</th><th scope="col" className="num">{compact ? 'Age' : 'Observation age'}</th></tr></thead><tbody>
          {rows.map(item => { const tick = snapshot.ticks[item.symbol]; return <tr key={item.symbol}><th scope="row">{item.symbol}</th>{!compact && <td>{item.provider_instrument_id}</td>}<td className="num">{tick?.bid || '—'}</td><td className="num">{tick?.ask || '—'}</td><td className="num">{tick ? ageText(tick.received_at_ms) : compact ? '—' : 'No observation'}</td></tr>; })}
          {!rows.length && <tr><td colSpan={compact ? 4 : 5}>{query ? 'No symbols match your search.' : 'This LP has not sent any symbols yet.'}</td></tr>}
        </tbody></table></div>
      </>}
      {!compact && <p className="lp-feeds-note">These displayed quotes are observations, not proof of an executable price.</p>}
    </div>
    {compact && <footer className="lp-feeds-footer"><span title={selected?.name || 'No provider selected'}>{selected?.name || 'No provider selected'}</span><span>{snapshot ? `Updated ${ageText(snapshot.publishedAt)} ago` : 'Named feeds'}</span></footer>}
    {!compact && <fieldset className="lp-feeds-account"><legend>Account effective quote source</legend>
      <p>Every account uses its group's single quote source. Configure the source on the group.</p>
      <div className="lp-feeds-load"><label>Account UUID<input value={account} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" spellCheck={false} onChange={event => { accountGeneration.current++; setBusy(false); setLoaded(null); setAccountError(''); setAccount(event.target.value); }} /></label>
        <button type="button" disabled={busy || !account.trim()} onClick={perform}>Inspect account source</button></div>
      {loaded && <div className="lp-feeds-account-current" role="group" aria-label="Effective account source"><p>Account {loaded.account_id} - group {loaded.group_name}</p><p>Effective group source: {loaded.selection?.connection_id || 'None'} - revision {loaded.selection?.source_revision || '0'}</p></div>}
      {accountError && <p className="lp-feed-problem" role="alert">{accountError}</p>}
    </fieldset>}
    {!compact && <LPGroupFeedControls feeds={feeds} permissions={permissions} />}
  </section>;
}
