import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./ServerPropertiesPopup.jsx', import.meta.url), 'utf8');
const appSrc = readFileSync(new URL('../../AuthenticatedApp.jsx', import.meta.url), 'utf8');
const tableSrc = readFileSync(new URL('../organisms/AdminDataTable.jsx', import.meta.url), 'utf8');

test('SUI-A6: OK is wired to the existing dismiss handler, not a no-op', () => {
  assert.match(src, /onClick=\{onClose\}>OK<\/button>/);
});

test('SUI-A6: Help is wired to onHelp with a disabled fallback, never a silent no-op', () => {
  assert.match(src, /const ServerPropertiesPopup = \(\{\s*isOpen,\s*onClose,\s*onHelp,/s);
  assert.match(src, /onClick=\{onHelp\}>Help<\/button>/);
  assert.match(src, /HELP_UNAVAILABLE = 'Help is not available for this dialog\.'/);
  assert.match(src, /<button disabled title=\{HELP_UNAVAILABLE\}[^>]*>Help<\/button>/);
});

test('SUI-A6: both live call sites wire Help to the workspace help', () => {
  // AuthenticatedApp owns HelpModal via setHelpOpen: MenuBar plus the two
  // ServerPropertiesPopup wirings (direct render and AdminDataTable pass-through).
  assert.equal(appSrc.match(/onHelp=\{\(\) => setHelpOpen\(true\)\}/g)?.length, 3);
  assert.match(appSrc, /<ServerPropertiesPopup[\s\S]*?onHelp=\{\(\) => setHelpOpen\(true\)\}/);
  // Pin the AdminDataTable pass-through source explicitly (line ~1048): without
  // this wiring AdminDataTable would receive undefined onHelp and its popup
  // would always render the disabled fallback.
  assert.match(appSrc, /<AdminDataTable[\s\S]*?onHelp=\{\(\) => setHelpOpen\(true\)\}/);
  // AdminDataTable forwards the handler to its popup.
  assert.match(tableSrc, /onHelp,/);
  assert.match(tableSrc, /onHelp=\{onHelp\}/);
});
