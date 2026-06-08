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
