import { useEffect, useState } from 'react';
import { ManagerService } from '../../services/manager.service.js';
import { loadRoutingGroupSymbols } from '../../services/lpGroupSymbols.js';

function GroupSymbolList({ selectorKey, exclusions, onApply, onRefresh }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let current = true;
    loadRoutingGroupSymbols(JSON.parse(selectorKey), ManagerService.getGroupAllowedSymbols)
      .then(value => { if (current) setResult(value); })
      .catch(() => { if (current) setError('Could not load group symbols. Check the included group names and refresh.'); });
    return () => { current = false; };
  }, [selectorKey]);
  const symbols = result?.symbols.filter(symbol => !exclusions.includes(symbol)) || [];
  return <div className="lpr-group-symbols" aria-label="Allowed group symbols">
    {!result && !error && <p role="status">Loading allowed group symbols…</p>}
    {error && <p role="alert" className="lpr-error">{error}</p>}
    {result && <>
      <p>{result.message || `${result.symbols.length} allowed group symbols fetched; ${symbols.length} after this rule’s symbol exclusions.`}</p>
      {result.symbols.length > 0 && <div className="lpr-group-symbol-list">{symbols.join(', ') || 'All fetched symbols are excluded by this rule.'}</div>}
    </>}
    <div className="lpr-actions">
      <button type="button" disabled={!symbols.length} onClick={() => onApply(symbols)}>Use all group symbols</button>
      <button type="button" onClick={onRefresh}>Refresh group symbols</button>
    </div>
    <p>Use all copies this list into Include symbols. Save the routing rule to apply it. Group permissions do not confirm LP trading readiness.</p>
  </div>;
}

export default function LPGroupSymbols({ selector, exclusions = [], onApply }) {
  const [refresh, setRefresh] = useState(0);
  const selectorKey = JSON.stringify({ include: selector?.include || [], exclude: selector?.exclude || [] });
  return <GroupSymbolList key={`${selectorKey}:${refresh}`} selectorKey={selectorKey} exclusions={exclusions} onApply={onApply} onRefresh={() => setRefresh(value => value + 1)} />;
}
