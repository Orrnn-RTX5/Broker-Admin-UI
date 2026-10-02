import { marketGroupCounts } from '../../../utils/marketCatalogue';
import './SymbolWorkspace.css';

const CATEGORY_DESCRIPTIONS = {
  Metals: 'Precious metals and metal pairs',
  Forex: 'Major, minor and cross currency pairs',
  Indices: 'Global stock and market indices',
  Crypto: 'Digital assets and cryptocurrency pairs',
  Commodities: 'Energy, agriculture and commodity markets',
  Others: 'Additional instruments and custom symbols',
};

const SymbolsOverviewPage = ({ onSelectCategory, catalogue = [] }) => {
  const counts = marketGroupCounts(catalogue);

  return (
    <div className="symbols-browser">
      <header className="symbols-page-header">
        <div className="symbols-page-heading">
          <h1>Symbols Browser</h1>
          <p>Browse the symbol catalogue by market category.</p>
        </div>
        <div className="symbols-page-summary" role="group" aria-label="Catalogue summary">
          <span>{catalogue.length} {catalogue.length === 1 ? 'symbol' : 'symbols'}</span>
          <span>{Object.keys(counts).length} categories</span>
        </div>
      </header>

      <div className="symbols-browser-content">
        <div className="symbols-section-heading">
          <h2>Market categories</h2>
          <span>Select a category to view its symbols</span>
        </div>
        <section className="symbols-category-grid" aria-label="Market categories">
          {Object.entries(counts).map(([name, count]) => {
            const names = catalogue.filter((entry) => entry.category === name).map((entry) => entry.symbol);
            const preview = names.slice(0, 3).join(', ');
            return (
              <button
                key={name}
                type="button"
                onClick={() => onSelectCategory?.(name)}
                className="symbols-category-card"
                aria-label={`Open ${name} symbols, ${count} ${count === 1 ? 'symbol' : 'symbols'}`}
              >
                <span className="symbols-category-topline">
                  <span className="symbols-category-title">{name}</span>
                  <span className="symbols-category-count">{count} {count === 1 ? 'symbol' : 'symbols'}</span>
                </span>
                <span className="symbols-category-description">
                  {Object.hasOwn(CATEGORY_DESCRIPTIONS, name) ? CATEGORY_DESCRIPTIONS[name] : `Symbols in the ${name} category`}
                </span>
                <span className="symbols-category-footer">
                  <span className="symbols-category-preview" title={names.join(', ')}>
                    {preview || 'No symbols assigned'}{names.length > 3 ? ` +${names.length - 3}` : ''}
                  </span>
                  <span className="symbols-category-action">View symbols</span>
                </span>
              </button>
            );
          })}
        </section>
      </div>
    </div>
  );
};

export default SymbolsOverviewPage;
