import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

test('MenuBar Exit invokes logout cleanup before window close or reload', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(here, 'MenuBar.jsx'), 'utf8');
  const handleExitStart = src.indexOf('const handleExit = () => {');
  const handleExitEnd = src.indexOf('  return (', handleExitStart);
  const handleExit = src.slice(handleExitStart, handleExitEnd);

  assert.notEqual(handleExitStart, -1, 'expected handleExit in MenuBar.jsx');
  assert.ok(
    handleExit.indexOf('AuthService.logout()') < handleExit.indexOf('window.close()'),
    'Exit must clear local auth/session state before attempting to close the window'
  );
  assert.ok(
    handleExit.indexOf('AuthService.logout()') < handleExit.indexOf('window.location.reload()'),
    'Exit must clear local auth/session state before reloading fallback'
  );
});

test('MenuBar About opens the in-app About dialog instead of a browser alert', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(here, 'MenuBar.jsx'), 'utf8');

  assert.match(src, /onHelp,\s*onAbout/);
  assert.match(src, /getBrokerBranding/);
  assert.match(src, /label=\{`About \$\{productName\}`\}\s+onClick=\{onAbout\}/);
  assert.doesNotMatch(src, /About RTX 5/);
});
