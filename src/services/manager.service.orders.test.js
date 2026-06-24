import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./manager.service.js', import.meta.url), 'utf8');

test('BrokerOrders uses the live API limit/offset contract', () => {
  const methodBlock = src.match(/getBrokerOrders:\s*async[\s\S]*?return res\.data;\s*\n\s*},/)?.[0] ?? '';

  assert.match(methodBlock, /getBrokerOrders:\s*async\s*\(limit = 100,\s*offset = 0\)/);
  assert.match(methodBlock, /api\.get\('\/manager\/BrokerOrders'/);
  assert.match(methodBlock, /params:\s*\{\s*limit,\s*offset\s*\}/);
  assert.doesNotMatch(methodBlock, /params:\s*\{\s*page,\s*limit\s*\}/);
});
