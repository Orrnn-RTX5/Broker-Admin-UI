import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./manager.service.js', import.meta.url), 'utf8');

test('BrokerOrders uses the live API limit/offset contract', () => {
  const methodBlock = src.match(/getBrokerOrders:\s*async[\s\S]*?return res\.data;\s*\n\s*},/)?.[0] ?? '';

  assert.match(methodBlock, /getBrokerOrders:\s*async\s*\(limitOrParams = 100,\s*offset = 0,\s*options = \{\}\)/);
  assert.match(methodBlock, /typeof limitOrParams === 'object'/);
  assert.match(methodBlock, /\{\s*limit:\s*limitOrParams,\s*offset\s*\}/);
  assert.match(methodBlock, /api\.get\('\/manager\/BrokerOrders'/);
  assert.match(methodBlock, /params\s*\n\s*\}\)/);
  assert.doesNotMatch(methodBlock, /params:\s*\{\s*page,\s*limit\s*\}/);
});

test('GroupUpdate strips UI-only originalName and uses it as the update target', () => {
  const methodBlock = src.match(/updateGroup:\s*async[\s\S]*?return res\.data;\s*\n\s*},/)?.[0] ?? '';

  assert.match(methodBlock, /const \{ originalName, \.\.\.payload \} = groupData;/);
  assert.match(methodBlock, /api\.post\('\/manager\/GroupUpdate', payload,/);
  assert.match(methodBlock, /params:\s*\{ group_name: originalName \|\| payload\.name \}/);
});
