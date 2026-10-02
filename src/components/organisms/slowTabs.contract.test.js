import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const readRoot = (relativePath) => readFileSync(resolve(__dirname, '..', '..', relativePath), 'utf8');

test('analytics ext-api reads are bounded and report tabs use cached retryable loading', () => {
  const service = readRoot('services/analytics.service.js');
  const hook = readRoot('hooks/useCachedTabRequest.js');
  const analyticsViews = [
    'components/organisms/AnalyticsClientView.jsx',
    'components/organisms/AnalyticsTradingView.jsx',
    'components/organisms/AnalyticsTradersView.jsx',
    'components/organisms/AnalyticsRevenueView.jsx',
  ].map(readRoot);

  assert.match(service, /ANALYTICS_READ_TIMEOUT_MS\s*=\s*8000/);
  assert.match(service, /timeout:\s*ANALYTICS_READ_TIMEOUT_MS/);
  assert.match(hook, /CACHED_TAB_REQUEST_TIMEOUT_MS\s*=\s*5000/);
  assert.match(hook, /Promise\.race/);
  assert.match(hook, /requestTokensRef/);
  assert.match(hook, /getApiErrorMessage/);
  assert.match(hook, /mountedRef\.current\s*=\s*true/);

  for (const source of analyticsViews) {
    assert.match(source, /useCachedTabRequest/);
    assert.match(source, /ActionableErrorState/);
    assert.doesNotMatch(source, /alert\('Failed:/);
    assert.doesNotMatch(source, /results\[tab\]/);
  }
});

test('server config initial loads are bounded and fail into retryable states', () => {
  const service = readRoot('services/serverConfig.service.js');
  const view = readRoot('components/organisms/ServerConfigView.jsx');
  const workspace = readRoot('components/organisms/ServerConfigWorkspace.jsx');
  const tables = readRoot('components/organisms/ServerConfigTables.jsx');

  assert.match(service, /SERVER_CONFIG_READ_TIMEOUT_MS\s*=\s*8000/);
  assert.match(service, /timeout:\s*SERVER_CONFIG_READ_TIMEOUT_MS/);
  assert.match(view, /ServerConfigWorkspace/);
  assert.match(workspace, /Server status failed to load\./);
  assert.match(tables, /Server settings failed to load\./);
  assert.match(tables, /Swap rates failed to load\./);
  assert.match(workspace, /ActionableErrorState/);
  assert.match(tables, /ActionableErrorState/);
  assert.match(workspace, /getApiErrorMessage/);
  assert.match(tables, /getApiErrorMessage/);
});
