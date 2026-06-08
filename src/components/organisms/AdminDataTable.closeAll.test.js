import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./AdminDataTable.jsx', import.meta.url), 'utf8');

test('Positions table exposes permission-gated close-all action through PositionsService.closeAll', () => {
  assert.match(src, /import\s+\{\s*PositionsService\s*\}/);
  assert.match(src, /getCloseAllActionState/);
  assert.match(src, /closeAllAction\.hasClosePermission/);
  assert.match(src, /closeAllAction\.canSubmit/);
  assert.match(src, /window\.prompt/);
  assert.match(src, /isCloseAllConfirmationAccepted/);
  assert.match(src, /PositionsService\.closeAll\(\{\s*symbol\s*\}\)/);
  assert.match(src, /Close All/);
});
