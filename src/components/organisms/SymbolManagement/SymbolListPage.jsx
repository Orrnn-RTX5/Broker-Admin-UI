import { ArrowLeft, Search } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import useSymbolStore from '../../../store/useSymbolStore';
import { isMarketQuoteFresh } from '../../../utils/marketWatch';

const quoteColorClass = direction => {
  if (direction === 'up') return 'text-[color:var(--success-500)]';
  if (direction === 'down') return 'text-[color:var(--danger-500)]';
  return 'text-[color:var(--text-muted)]';
};

const SymbolListPage = ({ group, onBack, catalogue = [] }) => {
  const quotes = useSymbolStore(state => state.symbols);
  const connected = useSymbolStore(state => state.isConnected);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);
  const symbols = useMemo(() => catalogue.filter(row => row.category === group).map(row => {
    const quote = quotes[row.symbol];
    const live = isMarketQuoteFresh(quote, connected, now);
    return {
      ...row,
      bid: live ? quote.bid ?? '—' : '—',
      ask: live ? quote.ask ?? '—' : '—',
      bidDir: live ? quote.bidDir : null,
      askDir: live ? quote.askDir : null,
      live,
    };
  }), [catalogue, group, quotes, connected, now]);
  const [search, setSearch] = useState('');

  const filteredSymbols = useMemo(() => {
    return symbols.filter(s => s.symbol.toLowerCase().includes(search.toLowerCase()));
  }, [symbols, search]);

  return (
    <div className="p-4 w-full h-full flex flex-col gap-3 overflow-hidden text-[11px] font-normal text-[color:var(--text-primary)]" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => onBack?.()}
          className="ui-btn ui-btn-ghost ui-btn-sm p-2"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-[12px] font-semibold" style={{ color: 'var(--text)' }}>{group} Symbols</h1>
          <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>Showing {filteredSymbols.length} symbols in this category</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative w-full max-w-md">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }} />
        <input 
          type="text" 
          placeholder={`Search in ${group}...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ui-input ui-input-sm w-full"
          style={{ paddingLeft: '34px' }}
        />
      </div>

      {/* List */}
      <div className="ui-card flex-1 overflow-hidden flex flex-col border" style={{ borderColor: 'var(--border)' }}>
        <div className="overflow-auto flex-1">
          <table className="w-full text-left border-collapse text-[11px] font-normal">
            <thead className="sticky top-0 z-10" style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
              <tr className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>
                <th className="px-3 py-2 font-semibold">Symbol</th>
                <th className="px-3 py-2 font-semibold text-right">Bid</th>
                <th className="px-3 py-2 font-semibold text-right">Ask</th>
                <th className="px-3 py-2 font-semibold text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-3)]">
              {filteredSymbols.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-4 py-12 text-center" style={{ color: 'var(--text-3)' }}>
                    No symbols found in this category.
                  </td>
                </tr>
              ) : (
                filteredSymbols.map((item) => (
                  <tr key={item.symbol} className="hover:bg-[var(--surface-hover)] transition-colors">
                    <td className="px-3 py-1.5 font-normal" style={{ color: 'var(--text)' }}>{item.symbol}</td>
                    <td className={`admin-quote-value px-3 py-1.5 text-right tabular-nums ${quoteColorClass(item.bidDir)}`}>
                       {item.bid}
                    </td>
                    <td className={`admin-quote-value px-3 py-1.5 text-right tabular-nums ${quoteColorClass(item.askDir)}`}>
                       {item.ask}
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="flex justify-center items-center">
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[var(--surface-2)] border border-[var(--border)]">
                           <div className={`w-1.5 h-1.5 rounded-full ${item.live ? 'bg-[var(--success-500)] animate-pulse' : 'bg-[var(--text-muted)]'}`} />
                           <span className="text-[11px] uppercase font-semibold" style={{ color: 'var(--text-3)' }}>{item.live ? 'Live' : 'No live quote'}</span>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SymbolListPage;
