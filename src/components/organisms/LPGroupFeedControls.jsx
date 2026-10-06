import React, { useEffect, useRef, useState } from 'react';
import { lpFeeds } from '../../services/lpFeeds.js';

export default function LPGroupFeedControls({ feeds, permissions }) {
  const [name, setName] = useState('');
  const [loaded, setLoaded] = useState(null);
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);

  const perform = async save => {
    const request = ++generation.current;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const value = save
        ? await lpFeeds.saveGroup(loaded.group_name, loaded.selection?.revision || '0', target)
        : await lpFeeds.group(name.trim());
      if (request === generation.current) {
        setLoaded(value);
        setTarget(value.selection?.connection_id || '');
        setNotice(save ? 'Group quote source saved. All accounts inherit this source.' : '');
      }
    } catch (e) {
      if (request === generation.current) { setError(e.message); if (!save) setLoaded(null); }
    } finally {
      if (request === generation.current) setBusy(false);
    }
  };
  const allowed = loaded && permissions.group('configuration', loaded.group_name)
    && permissions.connection('configuration', target)
    && (!loaded.selection || permissions.connection('configuration', loaded.selection.connection_id));

  return <fieldset className="lp-feeds-group"><legend>Group quote source</legend>
    <p>Every account inherits this single group source. Every affected account must be authorized and have no positions, pending orders, or unresolved execution.</p>
    <div className="lp-feeds-load"><label>Group name<input value={name} onChange={event => { generation.current++; setBusy(false); setLoaded(null); setError(''); setNotice(''); setName(event.target.value); }} /></label>
      <button type="button" disabled={busy || !name.trim() || !permissions.group('view', name.trim())} onClick={() => perform(false)}>{busy && !loaded ? 'Loading group…' : 'Load group source'}</button></div>
    {loaded && <>
      <div className="lp-feeds-account-current" role="group" aria-label="Current group source"><strong>Current group source</strong><p>Group: {loaded.group_name}</p><p>Source: {loaded.selection?.connection_id || 'None'} · revision {loaded.selection?.revision || '0'}</p></div>
      <div className="lp-feeds-account-fields"><label>Group source<select value={target} disabled={busy} onChange={event => setTarget(event.target.value)}><option value="">Choose a source</option>{target && !feeds.some(feed => feed.source_id === target) && <option value={target}>{target} — unavailable</option>}{feeds.map(feed => <option key={feed.source_id} value={feed.source_id}>{feed.name} ({feed.source_id})</option>)}</select></label></div>
      <div className="lp-feeds-account-actions"><button type="button" disabled={busy || !allowed || !feeds.some(feed => feed.source_id === target)} onClick={() => perform(true)}>{busy ? 'Saving…' : 'Save group source'}</button>{!target && <span className="lp-feeds-note">Choose the single source for this group.</span>}</div>
      {!allowed && <p className="lp-feeds-note">Configuration permission for this group and both source connections is required.</p>}
    </>}
    {error && <p className="lp-feed-problem" role="alert">{error}</p>}{notice && <p className="lp-feed-success" role="status">{notice}</p>}
    <p className="lp-feeds-note">A group without an available quote source has no substitute source.</p>
  </fieldset>;
}
