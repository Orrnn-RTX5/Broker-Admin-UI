import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./usePositions.js', import.meta.url), 'utf8');

test('useOrders fetches only the current BrokerOrders page with filters', () => {
  assert.match(src, /import\s+\{\s*useCallback,\s*useEffect,\s*useRef\s*\}\s+from 'react'/);
  assert.doesNotMatch(src, /const ORDER_MAX_PAGES = 50/);
  assert.doesNotMatch(src, /const getOrderPageKey = \(order, index\) => \(/);
  assert.match(src, /export function useOrders\(params = \{\s*limit:\s*100,\s*offset:\s*0,\s*logins:\s*\[\]\s*\}/);
  assert.match(src, /const loginsKey = JSON\.stringify\(params\.logins \?\? \[\]\)/);
  assert.match(src, /const fetcher = useCallback\(async \(\) => \{/);
  assert.match(src, /const logins = JSON\.parse\(loginsKey\)/);
  assert.doesNotMatch(src, /if \(allPages\) \{/);
  assert.doesNotMatch(src, /seenPageSignatures/);
  assert.match(src, /ManagerService\.getBrokerOrders\(\{\s*limit,\s*offset:\s*startOffset,\s*search,\s*symbol,\s*from,\s*to,\s*openOnly,\s*\}\)/);
  assert.match(src, /\}, \[from,\s*limitParam,\s*loginsKey,\s*offsetParam,\s*openOnly,\s*search,\s*symbol,\s*to\]\)/);
  assert.match(src, /useDataFetch\(\s*fetcher,\s*null,\s*\[from,\s*limitParam,\s*loginsKey,\s*offsetParam,\s*openOnly,\s*search,\s*symbol,\s*to\],\s*enabled,\s*\{\s*requestKey:\s*'manager:orders'\s*\}\s*\)/);
});

test('usePositions auto-refresh skips hidden tabs and overlapping refreshes', () => {
  assert.match(src, /const refreshInFlightRef = useRef\(false\)/);
  assert.match(src, /document\.visibilityState === 'hidden'/);
  assert.match(src, /if \(refreshInFlightRef\.current\) return/);
  assert.match(src, /const mutatePositions = hook\.mutate/);
  assert.match(src, /await mutatePositions\(\)/);
  assert.match(src, /requestKey:\s*'manager:positions'/);
});
