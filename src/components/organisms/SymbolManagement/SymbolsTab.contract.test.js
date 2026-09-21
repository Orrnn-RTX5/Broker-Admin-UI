import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, 'SymbolsTab.jsx'), 'utf8');

test('SymbolsTab active toggle uses InstrumentsService gateway contract', () => {
  assert.match(source, /InstrumentsService\.toggleInstrument\(/);
  assert.match(source, /const\s+targetEnabled\s*=\s*!sym\.enabled/);
  assert.match(source, /InstrumentsService\.toggleInstrument\(sym\.symbol,\s*targetEnabled\)/);
  assert.doesNotMatch(source, /\bsymbolEnable\b/);
  assert.doesNotMatch(source, /\bsymbolDisable\b/);
});

test('SymbolsTab initial load uses InstrumentsService instead of legacy symbolList fan-out', () => {
  assert.doesNotMatch(source, /symbolList\s*,/);
  assert.doesNotMatch(source, /\bsymbolList\(\)/);
  assert.match(source, /InstrumentsService\.getConfiguredInstruments\(\{\s*page:\s*1,\s*limit:\s*SYMBOL_MANAGEMENT_LIMIT,\s*search:\s*'',\s*enabled:\s*''\s*\}\)/);
  assert.match(source, /normalizeArrayResponse\(response,\s*SYMBOL_RESPONSE_KEYS\)/);
  assert.match(source, /withTimeout\(\s*symbolCategoryList\(\),\s*CATEGORY_LOAD_TIMEOUT_MS,/);
});
