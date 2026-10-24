import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const browserStorage = new Map();
globalThis.localStorage = {
  getItem: (key) => browserStorage.get(key) ?? null,
  setItem: (key, value) => browserStorage.set(key, String(value)),
  removeItem: (key) => browserStorage.delete(key),
};

const {
  catalogueFromDynamic,
  clearSymbolViewSnapshots,
  initialMarketBrowserState,
  initialSymbolManagementState,
  rememberMarketCatalogue,
  rememberSymbolManagement,
} = await import('./dynamicSymbolView.js');

const streamed = (count) => Array.from({ length: count }, (_, index) => `SYM${String(index).padStart(4, '0')}`);

beforeEach(() => {
  browserStorage.clear();
  clearSymbolViewSnapshots();
  browserStorage.set('brokerId', 'orrnn');
});

test('symbol browser and symbol management paint 2000 dynamic symbols in under 20ms', () => {
  const live = { feedSymbolNames: streamed(2000), symbolMetadata: [], symbols: {} };
  initialMarketBrowserState(live);
  initialSymbolManagementState(live);
  clearSymbolViewSnapshots();
  const browserStart = performance.now();
  const browser = initialMarketBrowserState(live);
  const browserElapsed = performance.now() - browserStart;
  clearSymbolViewSnapshots();
  const managementStart = performance.now();
  const management = initialSymbolManagementState(live);
  const managementElapsed = performance.now() - managementStart;

  assert.ok(browserElapsed < 20, `symbol browser prepared in ${browserElapsed.toFixed(2)}ms`);
  assert.ok(managementElapsed < 20, `symbol management prepared in ${managementElapsed.toFixed(2)}ms`);
  assert.equal(browser.loading, false);
  assert.equal(browser.syncing, true);
  assert.equal(browser.catalogue.length, 2000);
  assert.equal(management.loading, false);
  assert.equal(management.fromDynamic, true);
  assert.equal(management.lpEntries.length, 2000);
  assert.equal(management.lpEntries[0].detailsPending, true);
});

test('a saved catalogue is reused without reading the feed again', () => {
  rememberMarketCatalogue([{ symbol: 'EURUSD', category: 'Forex' }]);
  const browser = initialMarketBrowserState({ feedSymbolNames: ['BTCUSD'] });
  assert.deepEqual(browser.catalogue, [{ symbol: 'EURUSD', category: 'Forex' }]);
  assert.equal(browser.loading, false);
});

test('a saved management list opens immediately and a cold empty feed still waits', () => {
  rememberSymbolManagement({
    symbols: [{ symbol: 'EURUSD', enabled: true }],
    categories: [{ name: 'Forex' }],
    lpEntries: [],
  });
  const warm = initialSymbolManagementState({ feedSymbolNames: null });
  assert.equal(warm.loading, false);
  assert.equal(warm.fromDynamic, false);
  assert.equal(warm.symbols[0].symbol, 'EURUSD');

  clearSymbolViewSnapshots();
  const cold = initialSymbolManagementState({ feedSymbolNames: null, symbolMetadata: [], symbols: {} });
  assert.equal(cold.loading, true);
  assert.equal(cold.lpEntries.length, 0);
});

test('an empty streamed inventory is not replaced by older saved names', () => {
  const catalogue = catalogueFromDynamic({
    feedSymbolNames: [],
    symbolMetadata: [{ symbol: 'EURUSD', category: 'Forex' }],
  });
  assert.deepEqual(catalogue, []);
});

test('a hard reload reads the persisted symbol list synchronously', () => {
  browserStorage.set('rtx-symbols-storage:orrnn', JSON.stringify({
    state: { symbolMetadata: [{ symbol: 'XAUUSD', category: 'Metals' }, { symbol: 'EURUSD', category: 'Forex' }] },
    version: 1,
  }));
  const start = performance.now();
  const browser = initialMarketBrowserState({});
  const elapsed = performance.now() - start;
  assert.ok(elapsed < 20, `persisted catalogue prepared in ${elapsed.toFixed(2)}ms`);
  assert.equal(browser.loading, false);
  assert.deepEqual(browser.catalogue.map((row) => row.symbol), ['EURUSD', 'XAUUSD']);
});

test('the symbol browser renders the dynamic catalogue instead of waiting on the network', () => {
  const source = readFileSync(new URL('../components/organisms/MarketsView.jsx', import.meta.url), 'utf8');
  assert.match(source, /initialMarketBrowserState\(useSymbolStore\.getState\(\)\)/);
  assert.match(source, /rememberMarketCatalogue\(next\)/);
  assert.doesNotMatch(source, /const \[loading, setLoading\] = useState\(true\)/);
});

test('another broker scope cannot see this session snapshot', () => {
  rememberMarketCatalogue([{ symbol: 'EURUSD', category: 'Forex' }], 'orrnn');
  const other = initialMarketBrowserState({ feedSymbolNames: [] }, 'other-broker');
  assert.deepEqual(other.catalogue, []);
  assert.equal(other.loading, true);
});
