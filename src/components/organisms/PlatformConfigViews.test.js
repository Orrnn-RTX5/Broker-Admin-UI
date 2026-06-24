import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const readSource = (fileName) => readFileSync(join(here, fileName), 'utf8');

test('Platform Config list views normalize wrapped API data and show load errors', () => {
  for (const fileName of ['CustomFieldsView.jsx', 'FeatureFlagsView.jsx', 'SymbolVisibilityView.jsx']) {
    const source = readSource(fileName);

    assert.match(
      source,
      /import \{ getApiErrorMessage, normalizeArrayResponse \} from '\.\.\/\.\.\/utils\/apiShapes';/,
      `${fileName} should use shared API response/error helpers`
    );
    assert.match(
      source,
      /setLoadError\(''\);[\s\S]*?normalizeArrayResponse\(/,
      `${fileName} should clear prior load errors and accept wrapped array responses`
    );
    assert.match(
      source,
      /catch \(err\) \{[\s\S]*?setData\(\[\]\);|catch \(err\) \{[\s\S]*?setList\(\[\]\);/,
      `${fileName} should still clear stale rows on load failure`
    );
    assert.match(
      source,
      /setLoadError\(getApiErrorMessage\(err,/,
      `${fileName} should expose backend load failures instead of silently rendering blank`
    );
  }
});

test('Trading Terminal Config shows load errors inline', () => {
  const source = readSource('TradingTerminalConfigView.jsx');

  assert.match(source, /import \{ getApiErrorMessage \} from '\.\.\/\.\.\/utils\/apiShapes';/);
  assert.match(source, /const \[loadError, setLoadError\] = useState\(''\);/);
  assert.match(source, /setLoadError\(getApiErrorMessage\(err, 'Failed to load trading terminal config\.'\)\);/);
  assert.match(source, /loadError \? \(/);
});
