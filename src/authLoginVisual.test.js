import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const brokerAuthScreens = readFileSync(
  join(repoRoot, 'src', 'components', 'organisms', 'BrokerAuthScreens.jsx'),
  'utf8'
);

test('login hero visual uses responsive WebP assets only', () => {
  const expectedAssets = [
    'auth-trading-visual-960.webp',
    'auth-trading-visual-1280.webp',
    'auth-trading-visual.webp',
    'auth-trading-visual-1920.webp',
  ];

  for (const asset of expectedAssets) {
    const assetPath = join(repoRoot, 'src', 'assets', asset);
    assert.ok(existsSync(assetPath), `${asset} should exist`);
    assert.ok(statSync(assetPath).size > 0, `${asset} should not be empty`);
  }

  assert.match(brokerAuthScreens, /AUTH_VISUAL_SRC_SET/);
  assert.match(brokerAuthScreens, /sizes="\(min-width: 1024px\) 100vw, 0px"/);
  assert.match(brokerAuthScreens, /type="image\/webp"/);
  assert.match(brokerAuthScreens, /fetchPriority="high"/);
  assert.match(brokerAuthScreens, /authTradingVisual1920Webp/);
  assert.doesNotMatch(brokerAuthScreens, /auth-trading-visual\.png/);
});
