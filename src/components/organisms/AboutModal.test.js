import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const aboutSrc = readFileSync(join(here, 'AboutModal.jsx'), 'utf8');
const appSrc = readFileSync(join(here, '..', '..', 'AuthenticatedApp.jsx'), 'utf8');

test('AboutModal shows product details and Orrnn support contact', () => {
  assert.match(aboutSrc, /title="About RTX 5"/);
  assert.match(aboutSrc, /RTX 5 Admin/);
  assert.match(aboutSrc, /support@orrnn\.com/);
  assert.match(aboutSrc, /getRuntimeLabel/);
  assert.doesNotMatch(aboutSrc, /localhost:5173|alert\(/);
});

test('AuthenticatedApp wires About RTX 5 to in-app modal state', () => {
  assert.match(appSrc, /import \{ AboutModal \} from '\.\/components\/organisms\/AboutModal';/);
  assert.match(appSrc, /const \[aboutOpen,\s*setAboutOpen\] = React\.useState\(false\)/);
  assert.match(appSrc, /onAbout=\{\(\) => setAboutOpen\(true\)\}/);
  assert.match(appSrc, /<AboutModal open=\{aboutOpen\} onOpenChange=\{setAboutOpen\} \/>/);
});
