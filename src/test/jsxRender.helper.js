// Test-only helper: render Admin JSX components under plain Windows node:test.
// No browser, no Docker, no new dependencies.
// Bundles the target .jsx (plus its transitive graph) with the already-installed
// `rolldown` package (hoisted via vite), keeping react/react-dom external so the
// test process's React instance is shared, then imports the emitted ESM from a
// gitignored cache dir. Emitted + entry files live under node_modules/.cache so
// the repo tree only gains this helper and *.test.js files.
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const cacheDir = join(repoRoot, 'node_modules', '.cache', 'ds20-jsx');

function loadRolldown() {
  // rolldown is not a direct dependency (it arrives via vite); resolve it from
  // the workspace node_modules without adding it to package.json.
  const require = createRequire(join(repoRoot, 'package.json'));
  return require('rolldown');
}

// Bundle `targetRel` (repo-relative .jsx path, e.g.
// 'src/components/molecules/TreeItem.jsx') and return its module namespace.
export async function loadJsxModule(targetRel) {
  const { rolldown } = loadRolldown();
  const targetAbs = resolve(repoRoot, targetRel);
  const safeName = targetRel.replace(/[^a-zA-Z0-9]+/g, '_');
  mkdirSync(cacheDir, { recursive: true });
  const entryFile = join(cacheDir, `${safeName}.entry.js`);
  const outFile = join(cacheDir, `${safeName}.bundle.mjs`);
  writeFileSync(entryFile, `export { default } from ${JSON.stringify(targetAbs)};\n`);
  const bundle = await rolldown({
    input: entryFile,
    // Keep React shared with the test process; bundle everything else
    // (lucide-react, clsx, tailwind-merge, local utils) for hermetic imports.
    external: [/^react$/, /^react\//, /^react-dom$/, /^react-dom\//],
    platform: 'node',
  });
  try {
    await bundle.write({ file: outFile, format: 'esm' });
  } finally {
    await bundle.close();
  }
  return import(pathToFileURL(outFile).href);
}
