import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./PaymentMethodsView.jsx', import.meta.url), 'utf8');

test('Payment Methods type cells clip long backend method names inside the column', () => {
  assert.match(src, /\{ label: 'Type', w: 'w-\[120px\]' \}/);
  assert.match(src, /const clippedTextClassName = 'block min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap';/);
  assert.match(
    src,
    /<div className="w-\[120px\] px-3 py-1 text-\[12px\] border-r border-black\/10 shrink-0 flex items-center min-w-0 overflow-hidden" title=\{fmt\(row\.method_type\)\}>/
  );
  assert.match(src, /<span className=\{`\$\{clippedTextClassName\} font-mono text-\[11px\] px-1\.5 py-0\.5 rounded-\[2px\] bg-black\/30`\}/);
});
