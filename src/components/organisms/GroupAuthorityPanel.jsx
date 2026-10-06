import { useCallback, useEffect, useRef, useState } from 'react';
import { GROUP_INHERITABLE_FIELDS, groupFieldLabel, groupFieldState, inheritedFieldReset } from '../../utils/groupAuthority.js';

export default function GroupAuthorityPanel({ name, readGroup, updateGroup, canManage = false, canChangeField = () => true, onSaved, disabled = false }) {
  const [group, setGroup] = useState(null), [parent, setParent] = useState(''), [purpose, setPurpose] = useState('customer');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const generation = useRef(0);
  const apply = useCallback(fresh => { setGroup(fresh); setParent(fresh.parentGroup || ''); setPurpose(fresh.groupPurpose || 'customer'); }, []);
  const load = useCallback(async () => {
    const request = ++generation.current; setBusy(true); setError('');
    try { const fresh = await readGroup(name); if (request === generation.current) apply(fresh); }
    catch (e) { if (request === generation.current) { setGroup(null); setError(e.message || 'Unable to load group inheritance.'); } }
    finally { if (request === generation.current) setBusy(false); }
  }, [name, readGroup, apply]);
  useEffect(() => { const requestState = generation; load(); return () => { requestState.current++; }; }, [load]);
  const save = async (payload, message) => {
    if (!canManage || disabled || busy) return;
    const request = ++generation.current; setBusy(true); setError(''); setNotice('');
    try {
      await updateGroup(name, payload);
      const fresh = await readGroup(name);
      if (request !== generation.current) return;
      apply(fresh); setNotice(message); onSaved?.(fresh);
    } catch (e) {
      if (request === generation.current) { setError(e.response?.data?.message || e.body?.message || e.message || 'Unable to update group inheritance.'); setGroup(null); }
    } finally { if (request === generation.current) setBusy(false); }
  };
  const validRevision = /^lcr1:[0-9a-f]{24}$/.test(group?.revision || '');
  return <section aria-label="Group authority and inheritance" style={{ fontSize: '11px', fontWeight: 400 }}>
    <p>The group controls one quote feed, symbols and execution routing for every account. Parent settings stay current until a setting is overridden.</p>
    <button type="button" disabled={busy} onClick={load}>Refresh inherited settings</button>
    {busy && <p role="status">Loading or saving group settings...</p>}
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {group && <>
      <fieldset disabled={busy || disabled || !canManage || !validRevision}>
        <legend>Parent and account purpose</legend>
        <label>Parent group<input aria-label="Parent group" value={parent} onChange={e => setParent(e.target.value)} placeholder="No parent" /></label>
        <label>Purpose for new accounts<select aria-label="Group account purpose" value={purpose} onChange={e => setPurpose(e.target.value)}><option value="customer">Customer</option><option value="coverage">Coverage</option></select></label>
        <p>Every account created in a coverage group is a coverage account. Each new account separately chooses its permanent netting or hedging mode.</p>
        <button type="button" disabled={parent.trim() === (group.parentGroup || '') && purpose === (group.groupPurpose || 'customer')} onClick={() => save({ expected_revision: group.revision, ...(parent.trim() !== (group.parentGroup || '') ? { parentGroup: parent.trim() || null } : {}), ...(purpose !== (group.groupPurpose || 'customer') ? { groupPurpose: purpose } : {}) }, 'Group parent and purpose saved.')}>Save parent and purpose</button>
      </fieldset>
      {!validRevision && <p role="alert">A current group revision is required to change inheritance.</p>}
      <p>Overriding symbols or routing replaces the complete inherited list. Reset to inherit restores the latest parent list.</p>
      <div style={{ maxHeight: '280px', overflow: 'auto' }}><table><thead><tr><th>Setting</th><th>Effective value</th><th>Authority</th><th>Action</th></tr></thead><tbody>
        {GROUP_INHERITABLE_FIELDS.map(field => <tr key={field}><td>{groupFieldLabel(field)}</td><td>{Array.isArray(group[field]) ? group[field].map(value => typeof value === 'object' ? value.symbol || value.id || JSON.stringify(value) : value).join(', ') || 'Empty list' : typeof group[field] === 'boolean' ? String(group[field]) : group[field] === undefined ? 'Configured in LP settings' : String(group[field])}</td><td>{groupFieldState(group, field)}</td><td>{group.parentGroup && canChangeField(field) && <button type="button" disabled={busy || disabled || !canManage || !validRevision || (!group.overriddenFields?.includes(field) && (group[field] === undefined || ['symbolSettings', 'quoteFeed', 'routingRules'].includes(field)))} onClick={() => {
          if (group.overriddenFields?.includes(field)) save(inheritedFieldReset(group, field), `${groupFieldLabel(field)} now inherits the latest parent setting.`);
          else save({ expected_revision: group.revision, [field]: group[field] }, `${groupFieldLabel(field)} saved as a local override.`);
        }}>{group.overriddenFields?.includes(field) ? 'Reset to inherit' : ['symbolSettings', 'quoteFeed', 'routingRules'].includes(field) ? 'Use the collection editor to override' : 'Override current value'}</button>}</td></tr>)}
      </tbody></table></div>
    </>}
  </section>;
}
