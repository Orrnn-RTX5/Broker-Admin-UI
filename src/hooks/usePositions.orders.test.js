import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./usePositions.js', import.meta.url), 'utf8');

test('useOrders can fetch BrokerOrders through all limit/offset pages', () => {
  assert.match(src, /import\s+\{\s*useCallback,\s*useEffect\s*\}\s+from 'react'/);
  assert.match(src, /import\s+\{\s*normalizeArrayResponse\s*\}\s+from '\.\.\/utils\/apiShapes'/);
  assert.match(src, /const ORDER_MAX_PAGES = 50/);
  assert.match(src, /const getOrderPageKey = \(order, index\) => \(/);
  assert.match(src, /export function useOrders\(params = \{\s*limit:\s*100,\s*offset:\s*0,\s*logins:\s*\[\],\s*allPages:\s*false\s*\}/);
  assert.match(src, /const loginsKey = JSON\.stringify\(params\.logins \?\? \[\]\)/);
  assert.match(src, /const fetcher = useCallback\(async \(\) => \{/);
  assert.match(src, /const logins = JSON\.parse\(loginsKey\)/);
  assert.match(src, /if \(allPages\) \{/);
  assert.match(src, /const seenOrderKeys = new Set\(\)/);
  assert.match(src, /const seenPageSignatures = new Set\(\)/);
  assert.match(src, /ManagerService\.getBrokerOrders\(limit,\s*offset\)/);
  assert.match(src, /normalizeArrayResponse\(rawPage,\s*ORDER_RESPONSE_KEYS\)/);
  assert.match(src, /if \(seenPageSignatures\.has\(pageSignature\)\) break/);
  assert.match(src, /offset \+= limit/);
  assert.match(src, /return allRows\.map\(formatOrderTimestamps\)/);
  assert.match(src, /\}, \[allPages,\s*limitParam,\s*loginsKey,\s*offsetParam\]\)/);
  assert.match(src, /useDataFetch\(fetcher,\s*null,\s*\[allPages,\s*limitParam,\s*loginsKey,\s*offsetParam\],\s*enabled\)/);
});
