import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const marketWatch = readFileSync(new URL('./MarketWatchDock.jsx', import.meta.url), 'utf8');
const symbolStore = readFileSync(new URL('../../store/useSymbolStore.js', import.meta.url), 'utf8');

test('Market Watch Ticks navigation has no timer or network wait', () => {
  assert.doesNotMatch(marketWatch, /clickTimerRef|\},\s*220\s*\)/);
  assert.match(marketWatch, /handleSymbolDoubleClick\s*=\s*useCallback\(\(name\)\s*=>\s*commitMarketView\(name, 'Ticks'\)/);
  assert.match(marketWatch, /onClick=\{\(\)\s*=>\s*activateMarketTab\('Ticks'\)\}/);
  assert.match(marketWatch, /seedMarketTickHistory\(\s*normalizedName,\s*cachedQuote/);
});

test('Market Watch isolates hot quote renders and commits feed ticks within one frame', () => {
  assert.match(marketWatch, /const MarketSymbolRow = memo/);
  assert.match(marketWatch, /state\.symbols\[name\]/);
  assert.match(marketWatch, /const symbolMetadata = useSymbolStore/);
  assert.doesNotMatch(marketWatch, /const symbols = useSymbolStore/);
  assert.match(symbolStore, /requestAnimationFrame\(callback\)/);
  assert.doesNotMatch(symbolStore, /\},\s*100\s*\)/);
});

test('hot quote updates use deferred metadata-only persistence', () => {
  assert.match(symbolStore, /storage:\s*symbolPersistStorage/);
  const partialize = symbolStore.match(/partialize:\s*\(state\)\s*=>\s*\(\{([\s\S]*?)\}\),/);
  assert.ok(partialize, 'partial persistence configuration is present');
  assert.match(partialize[1], /symbolMetadata/);
  assert.doesNotMatch(partialize[1], /symbols:/);
  assert.match(symbolStore, /nextBrokerScope !== get\(\)\.brokerScope/);
  assert.match(symbolStore, /symbols:\s*\{\},\s*symbolMetadata:\s*\[\]/);
});
