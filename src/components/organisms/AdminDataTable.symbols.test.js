import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./AdminDataTable.jsx', import.meta.url), 'utf8');

test('Symbols view uses paged broker symbol data instead of a fixed first page', () => {
  assert.match(src, /const PAGED_VIEW_TYPES = new Set\(\['Groups', 'Clients', 'Trading Accounts', 'Symbols', 'Orders', 'Positions', 'Deals'\]\)/);
  assert.match(src, /useInstruments\(activePage,\s*pageSize,\s*debouncedSearchQuery,\s*'',\s*viewType === 'Symbols'\)/);
  assert.match(src, /response:\s*symbolsResponse/);
  assert.match(src, /keys:\s*\['instruments', 'symbols', 'data', 'answer', 'items', 'rows', 'value'\]/);
  assert.match(src, /mapFn:\s*getSymbolRow/);
  assert.match(src, /pagination = pageData/);
});
