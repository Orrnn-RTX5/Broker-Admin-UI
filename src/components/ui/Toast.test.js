import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const readSource = (relativePath) => {
  const here = dirname(fileURLToPath(import.meta.url));
  return readFileSync(join(here, relativePath), 'utf8');
};

test('ToastProvider shows only one toast at a time', () => {
  const source = readSource('Toast.jsx');

  assert.match(
    source,
    /setToasts\(\[\{ id: crypto\.randomUUID\?\.\(\) \?\? Date\.now\(\), \.\.\.t \}\]\)/,
    'notify should replace the current toast instead of stacking multiple popups'
  );
  assert.doesNotMatch(
    source,
    /setToasts\(\(prev\)\s*=>\s*\[\.\.\.prev,/,
    'notify must not append new toasts to the existing visible list'
  );
});
