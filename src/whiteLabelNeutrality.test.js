import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// White-label pin for the d9b7791 shell/config leg: vite.config.js,
// docker-entrypoint.sh and .env.example ship deployment defaults to every
// broker, so a hardcoded tenant host here silently re-targets all
// deployments (previously superbackend.orrnn.com / backend.orrnn.com /
// trivanta-markets fixtures). These files have no unit-testable logic, so
// neutrality is pinned the same way as the repo's source-grep tests: the
// forbidden tenant literals must not appear (case-insensitive). Deleting a
// pinned file also fails, because the read itself throws.
const repoRoot = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));

const PINNED_FILES = ['vite.config.js', 'docker-entrypoint.sh', '.env.example'];

// Tenant-specific literals that must never be compiled into shared
// deployment files. Generic reserved-example hosts (broker.example.com,
// platform.example.com) are the allowed placeholders.
const FORBIDDEN_PATTERNS = [/orrnn/i, /trivanta/i];

for (const file of PINNED_FILES) {
  test(`${file} carries no broker-specific literals`, () => {
    const source = readFileSync(join(repoRoot, file), 'utf8');
    for (const pattern of FORBIDDEN_PATTERNS) {
      assert.doesNotMatch(
        source,
        pattern,
        `${file} must not hardcode ${pattern} (white-label: configure per deployment)`,
      );
    }
  });
}

// UI text in these files must not show the legacy RTX5 brand. Each file below
// carries no RTX5 identifiers at all (storage keys and env names live
// elsewhere), so the plain case-insensitive check is exact, not approximate.
const RTX5_FREE_UI_FILES = [
  'src/components/BugReportDialog.jsx',
  'src/components/organisms/ActionToolBar.jsx',
  'src/components/RIGHTCLICKJPOPUPS/ManagerPropertiesPopup.jsx',
  'src/components/RIGHTCLICKJPOPUPS/ServerPropertiesPopup.jsx',
  'src/components/organisms/AntiDDoSView.jsx',
  'src/components/organisms/IntegrationsView.jsx',
  'src/components/organisms/ManagersView.jsx',
  'src/data/terminalData.jsx',
  'src/components/organisms/DownstreamExportModal.jsx',
];

for (const file of RTX5_FREE_UI_FILES) {
  test(`${file} shows no RTX5 brand in UI text`, () => {
    const source = readFileSync(join(repoRoot, file), 'utf8');
    assert.doesNotMatch(
      source,
      /RTX ?-?5/i,
      `${file} must use neutral platform wording, not the RTX5 brand`,
    );
  });
}
