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
