import { useEffect, useState } from 'react';
import useSymbolStore from '../../store/useSymbolStore';
import { isMarketQuoteFresh } from '../../utils/marketWatch';
import SymbolFormModal from './SymbolManagement/SymbolFormModal';

export function SymbolQuoteStatus({symbol}) {
  const quote = useSymbolStore(state => state.symbols[symbol]);
  const connected = useSymbolStore(state => state.isConnected);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return <span>{isMarketQuoteFresh(quote, connected, now) ? 'Live' : 'No fresh quote'}</span>;
}

export function SymbolConfigurationAction({row, categories = [], onSaved}) {
  const [open, setOpen] = useState(false);
  return <>
    <button className="ui-btn ui-btn-secondary ui-btn-sm" onClick={event => {event.stopPropagation(); setOpen(true);}}>
      {row.configuration ? 'Edit' : 'Configure'}
    </button>
    {open && <div onClick={event => event.stopPropagation()}>
      <SymbolFormModal symbol={row.configuration} initialSymbol={{symbol: row.symbol, category: row.category}}
        categories={categories} onClose={() => setOpen(false)}
        onSuccess={() => {setOpen(false); onSaved();}} />
    </div>}
  </>;
}
