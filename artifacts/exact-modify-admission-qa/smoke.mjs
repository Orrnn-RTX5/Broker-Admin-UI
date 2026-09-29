// Run: node artifacts/exact-modify-admission-qa/smoke.mjs (live Vite on :5173, stubbed services only)
import {runFromCli} from '../qa-shared/cdp-runner.mjs';
await runFromCli('exact-modify-admission');
