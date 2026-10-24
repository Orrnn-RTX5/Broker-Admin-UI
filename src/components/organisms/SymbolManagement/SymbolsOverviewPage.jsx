import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { marketGroupCounts } from '../../../utils/marketCatalogue';
import './SymbolWorkspace.css';
import './SymbolsBrowser.css';

const CATEGORY_DESCRIPTIONS = {
  Metals: 'Precious metals and metal pairs',
  Forex: 'Major, minor and cross currency pairs',
  Indices: 'Global stock and market indices',
  Crypto: 'Digital assets and cryptocurrency pairs',
  Commodities: 'Energy, agriculture and commodity markets',
  Others: 'Additional instruments and custom symbols',
  Stocks: 'Company shares and exchange-listed equities',
  Futures: 'Exchange-traded futures contracts',
  Bonds: 'Government bonds and fixed-income instruments',
};

const SymbolsOverviewPage = ({ onSelectCategory, catalogue = [], syncing = false }) => {
  const [search, setSearch] = useState('');
  const categories = useMemo(() => {
    const groups = new Map(Object.entries(marketGroupCounts(catalogue)).map(([name, count]) => [name, { name, count, names: [] }]));
    for (const entry of catalogue) groups.get(entry.category).names.push(entry.symbol);
    return [...groups.values()];
  }, [catalogue]);
  const query = search.trim().toLowerCase();
  const visibleCategories = categories.filter(({ name, names }) => name.toLowerCase().includes(query) || names.some(symbol => symbol.toLowerCase().includes(query)));

  return (
    <div className="symbols-browser">
      <header className="symbols-page-header">
        <div className="symbols-page-heading">
          <h1>Symbols Browser</h1>
        </div>
        <div className="symbols-page-summary" role="group" aria-label="Catalogue summary">
          <span>{catalogue.length} {catalogue.length === 1 ? 'symbol' : 'symbols'}</span>
          <span>{categories.length} categories</span>
        </div>
        <label className="symbols-category-search">
          <Search size={13} aria-hidden="true" />
          <input
            type="search"
            aria-label="Search categories or symbols"
            placeholder="Search categories or symbols..."
            value={search}
            onChange={event => setSearch(event.target.value)}
          />
        </label>
      </header>

      <div className="symbols-browser-content">
        <div className="symbols-category-columns" aria-hidden="true">
          <span>Category</span>
          <span>Symbols</span>
          <span>Instrument preview</span>
          <span>Actions</span>
        </div>
        <section className="symbols-category-grid" aria-label="Market categories">
          {visibleCategories.map(({ name, count, names }) => (
              <button
                key={name}
                type="button"
                onClick={() => onSelectCategory?.(name)}
                className="symbols-category-card"
                aria-label={`Open ${name} symbols, ${count} ${count === 1 ? 'symbol' : 'symbols'}`}
              >
                <span className="symbols-category-details">
                  <span className="symbols-category-title">{name}</span>
                  <span className="symbols-category-description">
                    {Object.hasOwn(CATEGORY_DESCRIPTIONS, name) ? CATEGORY_DESCRIPTIONS[name] : `Symbols in the ${name} category`}
                  </span>
                </span>
                <span className="symbols-category-count">
                  {count}<span className="symbols-category-count-label"> {count === 1 ? 'symbol' : 'symbols'}</span>
                </span>
                <span className="symbols-category-preview" title={names.join(', ')}>
                  {names.slice(0, 3).join(', ') || 'No symbols assigned'}
                  {names.length > 3 && <span className="symbols-category-more"> +{names.length - 3}</span>}
                </span>
                <span className="symbols-category-action">View symbols</span>
              </button>
          ))}
          {visibleCategories.length === 0 && (
            <div className="symbols-category-empty" role="status">
              <strong>No matching categories</strong>
              <p>Try a category name or an instrument symbol.</p>
              <button type="button" className="ui-btn ui-btn-secondary ui-btn-sm" onClick={() => setSearch('')}>Clear search</button>
            </div>
          )}
        </section>
      </div>
      <footer className="symbols-browser-footer">
        <span role="status">Showing {visibleCategories.length} of {categories.length} categories{syncing ? ' · updating' : ''}</span>
        <span>Select a category to view its symbols</span>
      </footer>
    </div>
  );
};

export default SymbolsOverviewPage;
