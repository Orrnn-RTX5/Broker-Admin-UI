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

test('InstrumentsService falls back to manager symbol APIs when admin instruments route is missing', () => {
  assert.match(source, /api\.get\('\/api\/v2\/admin\/instruments',\s*\{ params: cleanParams\(params\) \}\)/);
  assert.match(source, /if \(!isNotFoundError\(error\)\) throw error;/);
  assert.match(source, /return getManagerInstruments\(params\);/);
  assert.match(source, /api\.get\('\/manager\/SymbolsList'\)/);
  assert.match(source, /api\.get\('\/manager\/SymbolList'\)/);
  assert.match(source, /api\.get\('\/manager\/SymbolsParams',\s*\{\s*params:\s*\{ symbols \},\s*\}\)/);
  assert.match(source, /total:\s*searchedNames\.length/);
  assert.match(source, /page:\s*safePage/);
  assert.match(source, /limit:\s*safeLimit/);
});
