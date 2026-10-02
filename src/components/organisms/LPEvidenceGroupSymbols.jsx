import { useEffect, useState } from 'react';
import { ManagerService } from '../../services/manager.service.js';
import { loadRoutingGroupSymbols } from '../../services/lpGroupSymbols.js';

function GroupInstrumentList({ group, symbol, onSelect }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!group) return undefined;
    let current = true;
    loadRoutingGroupSymbols({ include: [group], exclude: [] }, ManagerService.getGroupAllowedSymbols)
      .then(value => { if (current) setResult(value); })
      .catch(() => { if (current) setError('Could not load this group’s allowed symbols. Refresh and try again.'); });
    return () => { current = false; };
  }, [group]);

  const symbols = result?.symbols || [];
  const currentOutsideGroup = Boolean(symbol && !symbols.includes(symbol));
  const unrestricted = result?.message?.startsWith('A selected group allows all broker symbols.');

  return <>
    {group && !result && !error && <p role="status">Loading allowed group symbols…</p>}
    {error && <p role="alert" className="lpr-error">{error}</p>}
    {result && <p role="status">{symbols.length} allowed group symbols. {unrestricted
      ? 'This group allows all broker symbols; enter an instrument symbol in the evidence form.'
      : result.message}</p>}
    <label>Group instrument symbol
      <select aria-label="Group instrument symbol" value={symbol || ''} disabled={!symbols.length} onChange={event => onSelect(event.target.value)}>
        <option value="" disabled>Select a group instrument symbol</option>
        {currentOutsideGroup && <option value={symbol}>{symbol} (current evidence symbol)</option>}
        {symbols.map(value => <option key={value} value={value}>{value}</option>)}
      </select>
    </label>
    {result && currentOutsideGroup && !unrestricted && <p>The current evidence symbol is outside this group’s allowed list.</p>}
  </>;
}

export default function LPEvidenceGroupSymbols({ groups = [], symbol = '', onSelect }) {
  const [selectedGroup, setSelectedGroup] = useState('');
  const [refresh, setRefresh] = useState(0);
  const groupNames = [...new Set((Array.isArray(groups) ? groups : []).filter(name => typeof name === 'string' && name.trim()))];
  const group = groupNames.includes(selectedGroup) ? selectedGroup : (groupNames[0] || '');

  return <div className="lpr-group-symbols" aria-label="Evidence group symbols">
    <div className="lpr-fields">
      <label>Evidence symbol group
        <select value={group} disabled={!groupNames.length} onChange={event => setSelectedGroup(event.target.value)}>
          {!groupNames.length && <option value="">No included routing groups</option>}
          {groupNames.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
      </label>
      <GroupInstrumentList key={`${group}:${refresh}`} group={group} symbol={symbol} onSelect={onSelect} />
    </div>
    {!group && <p>No included routing groups are available for this connection. Enter the instrument symbol in the evidence form.</p>}
    <div className="lpr-actions"><button type="button" disabled={!group} onClick={() => setRefresh(value => value + 1)}>Refresh group symbols</button></div>
    <p>Selecting a symbol loads existing evidence for this connection or starts a blank record. Group permissions do not verify provider capability.</p>
  </div>;
}
