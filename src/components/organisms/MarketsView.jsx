import { useEffect, useState } from 'react';
import { InstrumentsService } from '../../services/instruments.service';
import { buildMarketCatalogue } from '../../utils/marketCatalogue';
import { catalogueFromDynamic, initialMarketBrowserState, rememberMarketCatalogue } from '../../utils/dynamicSymbolView';
import useSymbolStore from '../../store/useSymbolStore';

import SymbolManagementPage from './SymbolManagement/SymbolManagementPage';
import SymbolsOverviewPage from './SymbolManagement/SymbolsOverviewPage';
import SymbolListPage from './SymbolManagement/SymbolListPage';

const MarketBrowser = () => {
  const [initial] = useState(() => initialMarketBrowserState(useSymbolStore.getState()));
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [catalogue, setCatalogue] = useState(initial.catalogue);
  const [loading, setLoading] = useState(initial.loading);
  const [syncing, setSyncing] = useState(initial.syncing);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const streamedCount = useSymbolStore((state) => (
    Array.isArray(state.feedSymbolNames) ? state.feedSymbolNames.length : state.symbolMetadata.length
  ));

  useEffect(() => {
    if (!loading || catalogue.length > 0) return;
    const next = catalogueFromDynamic(useSymbolStore.getState());
    if (next.length === 0) return;
    setCatalogue(next);
    setLoading(false);
    setSyncing(true);
  }, [loading, catalogue.length, streamedCount]);

  useEffect(() => {
    let cancelled = false;
    const hadRows = catalogue.length > 0;
    if (hadRows) setSyncing(true);
    else setLoading(true);

    Promise.allSettled([
      InstrumentsService.getInstrumentCatalogue(),
      InstrumentsService.getConfiguredInstruments(),
    ]).then(([feed, configured]) => {
      if (cancelled) return;
      if (feed.status === 'fulfilled') {
        const next = buildMarketCatalogue(feed.value, configured.status === 'fulfilled' ? configured.value : []);
        setCatalogue(next);
        rememberMarketCatalogue(next);
        setError(configured.status === 'rejected'
          ? 'Configured categories are unavailable. Showing default categories; retry to refresh.'
          : '');
      } else if (hadRows) {
        setError('Unable to refresh assigned symbols. Showing the live catalogue.');
      } else {
        setCatalogue([]);
        setError('Unable to load assigned symbols. Retry to load the catalogue.');
      }
      setLoading(false);
      setSyncing(false);
    });
    return () => { cancelled = true; };
    // Reload is the only trigger. The catalogue already on screen must stay visible.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload]);

  const handleRetry = () => {
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
        <SymbolsOverviewPage catalogue={catalogue} syncing={syncing} onSelectCategory={setSelectedCategory} />
      )}
    </>
  );
};

const MarketsView = ({ section = 'browser' }) => {
  return (
    <div className="symbols-workspace flex-1 min-w-0 min-h-0 bg-[color:var(--bg-app)] flex flex-col overflow-hidden text-[color:var(--text-primary)]">
      {section === 'management' ? (
        <SymbolManagementPage />
      ) : (
        <MarketBrowser />
      )}
    </div>
  );
};

export default MarketsView;
