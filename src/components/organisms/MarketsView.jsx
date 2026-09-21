import { useEffect, useState } from 'react';
import { InstrumentsService } from '../../services/instruments.service';
import { buildMarketCatalogue } from '../../utils/marketCatalogue';

import SymbolManagementPage from './SymbolManagement/SymbolManagementPage';
import SymbolsOverviewPage from './SymbolManagement/SymbolsOverviewPage';
import SymbolListPage from './SymbolManagement/SymbolListPage';

const MarketBrowser = () => {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [catalogue, setCatalogue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      InstrumentsService.getInstrumentCatalogue(),
      InstrumentsService.getConfiguredInstruments(),
    ]).then(([feed, configured]) => {
      if (cancelled) return;
      if (feed.status === 'rejected') {
        setCatalogue([]);
        setError('Unable to load assigned symbols. Retry to load the catalogue.');
      } else {
        setCatalogue(buildMarketCatalogue(feed.value, configured.status === 'fulfilled' ? configured.value : []));
        if (configured.status === 'rejected') setError('Configured categories are unavailable. Showing default categories; retry to refresh.');
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [reload]);

  const handleRetry = () => {
    setLoading(true);
    setError('');
    setReload(value => value + 1);
  };

  return (
    <>
      {error && <div role="alert" className="px-6 py-2 text-sm">{error} <button className="ui-btn ui-btn-sm" onClick={handleRetry}>Retry</button></div>}
      {loading ? <p role="status" className="p-6">Loading symbol catalogue…</p> : selectedCategory ? (
        <SymbolListPage
          catalogue={catalogue}
          group={selectedCategory}
          onBack={() => setSelectedCategory(null)}
        />
      ) : (
        <SymbolsOverviewPage catalogue={catalogue} onSelectCategory={setSelectedCategory} />
      )}
    </>
  );
};

const MarketsView = ({ section = 'browser' }) => {
  return (
    <div className="flex-1 min-w-0 min-h-0 bg-[color:var(--bg-app)] flex flex-col overflow-hidden text-[color:var(--text-primary)]">
      {section === 'management' ? (
        <SymbolManagementPage />
      ) : (
        <MarketBrowser />
      )}
    </div>
  );
};

export default MarketsView;
