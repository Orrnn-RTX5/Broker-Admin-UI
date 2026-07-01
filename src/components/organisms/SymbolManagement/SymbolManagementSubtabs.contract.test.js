import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (file) => readFileSync(join(here, file), 'utf8');

const categories = read('CategoriesTab.jsx');
const mappings = read('LpMappingsTab.jsx');
const sessions = read('SessionsTab.jsx');
const commissionSwap = read('CommissionSwapTab.jsx');
const advanced = read('AdvancedTab.jsx');
const helper = read('symbolManagementData.js');

test('Symbol Management subtab symbol selectors use manager instruments, not quote WebSocket feed', () => {
  for (const source of [sessions, commissionSwap, advanced]) {
    assert.doesNotMatch(source, /buildFeedWsUrl/);
    assert.doesNotMatch(source, /new WebSocket/);
    assert.match(source, /loadSymbolOptions/);
  }

  assert.match(helper, /InstrumentsService\.getInstruments\(\{\s*page:\s*1,\s*limit:\s*SYMBOL_MANAGEMENT_LIMIT,\s*search:\s*'',\s*enabled:\s*''\s*\}\)/);
});

test('Symbol Management subtab lists normalize wrapped backend responses', () => {
  assert.match(categories, /normalizeCategoryRows\(data\)/);
  assert.match(categories, /normalizeSymbolOptions\(data\)/);
  assert.match(mappings, /normalizeMappingRows\(data\)/);
  assert.match(sessions, /normalizeSessionRows\(sessionsResult\.value\)/);
  assert.match(sessions, /normalizeOverrideRows\(overridesResult\.value\)/);
  assert.match(commissionSwap, /normalizeCommissionRows\(data\)/);
  assert.match(commissionSwap, /normalizeLeverageRows\(data\)/);
  assert.match(commissionSwap, /normalizeSwapFreeRows\(data\)/);
  assert.match(advanced, /normalizeMarketDepthConfig\(d\)/);
  assert.match(advanced, /normalizeVisibilityRows\(d\)/);
});

test('Advanced market depth treats missing config as editable default state', () => {
  assert.match(advanced, /const isMissingMarketDepthConfig = \(error\) =>/);
  assert.match(advanced, /status === 404/);
  assert.match(advanced, /market depth config\\b\.\*\\bnot found\\b/);
  assert.match(advanced, /setConfig\(normalizeMarketDepthConfig\(\{\}\)\)/);
  assert.match(advanced, /if \(isMissingMarketDepthConfig\(loadErr\)\)\s*\{\s*return;\s*\}/);
});

test('Symbol Management subtab load failures are shown with retryable error states', () => {
  for (const source of [categories, mappings, sessions, commissionSwap, advanced]) {
    assert.match(source, /ActionableErrorState/);
    assert.match(source, /getApiErrorMessage/);
    assert.match(source, /buildActionableErrorState/);
  }
});

test('Symbol Management data helper accepts known manager wrapper keys', () => {
  assert.match(helper, /\['categories',\s*'symbol_categories'/);
  assert.match(helper, /\['mappings',\s*'symbol_mappings'/);
  assert.match(helper, /\['sessions',\s*'symbol_sessions',\s*'trading_sessions'/);
  assert.match(helper, /\['overrides',\s*'session_overrides'/);
  assert.match(helper, /\['schedules',\s*'commissions',\s*'commission_schedules'/);
  assert.match(helper, /\['tiers',\s*'leverage',\s*'dynamic_leverage'/);
  assert.match(helper, /\['groups',\s*'swap_free_groups'/);
  assert.match(helper, /\['visibility',\s*'symbol_visibility',\s*'rules'/);
});
