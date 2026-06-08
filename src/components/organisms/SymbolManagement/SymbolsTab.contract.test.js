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
