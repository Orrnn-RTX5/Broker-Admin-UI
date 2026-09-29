// Runs every admin-panel QA harness in turn (headless Chrome over CDP against
// the live Vite on :5173, stubbed services only) and prints one line each.
// Usage: node artifacts/qa-shared/run-all.mjs [name ...]
import {runHarness} from './cdp-runner.mjs';

export const HARNESSES = [
  'lp-cleanup-recovery',
  'downstream-access',
  'source-gap',
  'exact-modify-admission',
  'broker-capabilities',
  'native-pending-enablement',
  'calculation-cutover',
  'account-config-popups',
  'exact-demo-sizing',
];

const selected = process.argv.slice(2).length ? process.argv.slice(2) : HARNESSES;
let failed = 0;
for (const name of selected) {
  const summary = await runHarness({name});
  const passed = summary.steps.filter(step => step.ok).length;
  const problem = summary.error || summary.steps.find(step => !step.ok)?.error || (summary.exceptions[0] && `exception: ${summary.exceptions[0]}`) || (summary.offPageRequests[0] && `off-page request: ${summary.offPageRequests[0]}`) || '';
  if (!summary.pass) failed += 1;
  console.log(`${summary.pass ? 'PASS' : 'FAIL'} ${name}: ${passed}/${summary.steps.length} steps${problem ? ` - ${problem}` : ''}`);
}
process.exitCode = failed ? 1 : 0;
