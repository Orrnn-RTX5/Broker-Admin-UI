import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const aboutSrc = readFileSync(join(here, 'AboutModal.jsx'), 'utf8');
const appSrc = readFileSync(join(here, '..', '..', 'AuthenticatedApp.jsx'), 'utf8');

test('AboutModal uses dynamic broker branding and support contact', () => {
  assert.match(aboutSrc, /getBrokerBranding/);
  assert.match(aboutSrc, /title=\{`About \$\{productName\}`\}/);
  assert.match(aboutSrc, /\{supportEmail\}/);
  assert.match(aboutSrc, /getRuntimeLabel/);
  assert.doesNotMatch(aboutSrc, /support@orrnn\.com|RTX 5 Admin|localhost:5173|alert\(/);
});

test('AuthenticatedApp wires About modal to in-app modal state', () => {
  assert.match(appSrc, /const AboutModal = React\.lazy\(\(\) => import\('\.\/components\/organisms\/AboutModal'\)\.then\(module => \(\{ default: module\.AboutModal \}\)\)\)/);
  assert.match(appSrc, /const \[aboutOpen,\s*setAboutOpen\] = React\.useState\(false\)/);
  assert.match(appSrc, /onAbout=\{\(\) => setAboutOpen\(true\)\}/);
  assert.match(appSrc, /<AboutModal open=\{aboutOpen\} onOpenChange=\{setAboutOpen\} \/>/);
});
