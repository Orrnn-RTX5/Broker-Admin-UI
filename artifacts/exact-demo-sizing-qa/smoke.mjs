// Run: node artifacts/exact-demo-sizing-qa/smoke.mjs (live Vite on :5173, stubbed services only)
import {runFromCli} from '../qa-shared/cdp-runner.mjs';
await runFromCli('exact-demo-sizing');
