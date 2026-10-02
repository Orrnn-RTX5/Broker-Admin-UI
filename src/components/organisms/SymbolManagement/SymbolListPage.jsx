import { useEffect, useState, useMemo } from 'react';
import useSymbolStore from '../../../store/useSymbolStore';
import { isMarketQuoteFresh } from '../../../utils/marketWatch';
import './SymbolWorkspace.css';

const quoteColorClass = direction => {
  if (direction === 'up') return 'text-[color:var(--market-profit)]';
  if (direction === 'down') return 'text-[color:var(--market-loss)]';
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
    <div className="symbols-list-page">
      <header className="symbols-page-header">
        <div className="symbols-page-heading">
          <h1>{group} Symbols</h1>
          <p>Browse instruments and their latest available quotes.</p>
        </div>
        <button
          type="button"
          onClick={() => onBack?.()}
          className="ui-btn ui-btn-secondary ui-btn-sm symbols-back-button"
        >
          Back to categories
        </button>
      </header>

      <div className="symbols-list-content">
        <div className="symbols-list-panel">
          <div className="symbols-list-toolbar">
            <input
              type="search"
              aria-label={`Search ${group} symbols`}
              placeholder={`Search ${group.toLowerCase()} symbols...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ui-input ui-input-sm"
            />
            <span>{symbols.length} {symbols.length === 1 ? 'symbol' : 'symbols'} in this category</span>
          </div>
          <div className="symbols-table-scroll">
            <table className="symbols-browser-table">
              <thead>
                <tr>
                  <th scope="col">Symbol</th>
                  <th scope="col" className="symbols-number-column">Bid</th>
                  <th scope="col" className="symbols-number-column">Ask</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredSymbols.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="symbols-list-empty">
                      {search ? 'No symbols match your search.' : 'No symbols available in this category.'}
                    </td>
                  </tr>
                ) : (
                  filteredSymbols.map((item) => (
                    <tr key={item.symbol}>
                      <td>{item.symbol}</td>
                      <td className={`admin-quote-value symbols-number-column ${quoteColorClass(item.bidDir)}`}>
                         {item.bid}
                      </td>
                      <td className={`admin-quote-value symbols-number-column ${quoteColorClass(item.askDir)}`}>
                         {item.ask}
                      </td>
                      <td>
                        <span className={`symbols-quote-status${item.live ? ' symbols-quote-status--live' : ''}`}>{item.live ? 'Live' : 'No live quote'}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <footer className="symbols-list-footer">
            <span>Showing {filteredSymbols.length} of {symbols.length} symbols</span>
            <span>Live quotes appear when available</span>
          </footer>
        </div>
      </div>
    </div>
  );
};

export default SymbolListPage;
