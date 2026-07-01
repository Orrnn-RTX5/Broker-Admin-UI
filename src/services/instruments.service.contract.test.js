import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./instruments.service.js', import.meta.url), 'utf8');

test('InstrumentsService.toggleInstrument requires and sends desired enabled state', () => {
  assert.match(source, /toggleInstrument:\s*async\s*\(symbol,\s*enabled\)/);
  assert.match(source, /typeof\s+enabled\s*!==\s*'boolean'/);
  assert.match(source, /buildInstrumentToggleRequest\(symbol,\s*enabled\)/);
  assert.match(source, /api\.patch\(request\.url,\s*request\.data\)/);
});

test('InstrumentsService uses manager symbols by default and keeps admin instruments opt-in', () => {
  assert.match(source, /VITE_INSTRUMENTS_LIST_MODE/);
  assert.match(source, /'manager'/);
  assert.match(source, /const shouldUseAdminInstrumentsList = \(\) =>/);
  assert.match(source, /if \(!shouldUseAdminInstrumentsList\(\)\) return getManagerInstruments\(params\);/);
  assert.match(
    source,
    /api\.get\('\/api\/v2\/admin\/instruments',\s*\{\s*params: cleanParams\(params\),\s*_expectedStatuses: \[404\],\s*\}\)/
  );
  assert.match(source, /if \(!isNotFoundError\(error\)\) throw error;/);
  assert.match(source, /return getManagerInstruments\(params\);/);
  assert.match(source, /MANAGER_SYMBOL_NAMES_CACHE_TTL_MS = 30000/);
  assert.match(source, /managerSymbolNamesCache/);
  assert.match(source, /managerSymbolNamesPromise/);
  assert.match(source, /api\.get\('\/manager\/SymbolsList'\)/);
  assert.match(source, /api\.get\('\/manager\/SymbolList'\)/);
  assert.match(source, /api\.get\('\/manager\/SymbolsParams',\s*\{\s*params:\s*\{ symbols \},\s*\}\)/);
  assert.match(source, /MANAGER_SYMBOL_PARAMS_TIMEOUT_MS = 7000/);
  assert.match(source, /withTimeout\(\s*api\.get\('\/manager\/SymbolsParams'/);
  assert.match(source, /catch\s*\{\s*return \[\];\s*\}/);
  assert.match(source, /total:\s*searchedNames\.length/);
  assert.match(source, /page:\s*safePage/);
  assert.match(source, /limit:\s*safeLimit/);
});

test('InstrumentsService normalizes fields required by Symbol Management', () => {
  assert.match(source, /symbolType:\s*normalizeSymbolType\(source\)/);
  assert.match(source, /category:\s*category \|\| ''/);
  assert.match(source, /contractSize:\s*toNumber\(firstDefined\(source\.contractSize/);
  assert.match(source, /spread:\s*toNumber\(firstDefined\(source\.spread/);
  assert.match(source, /calcMode:\s*firstDefined\(source\.calcMode/);
  assert.match(source, /parentSymbol:\s*parentSymbol \|\| ''/);
  assert.match(source, /spreadMarkupPips:\s*toNumber\(firstDefined\(source\.spreadMarkupPips/);
  assert.match(source, /enabled:\s*normalizeEnabledValue\(source\)/);
});
