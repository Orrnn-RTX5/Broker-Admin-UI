// Headless Chrome (CDP) runner for the admin-panel QA harnesses, following
// artifacts/groups-navigation-qa/smoke.mjs. It opens artifacts/<name>-qa/
// index.html on the live Vite dev server, runs each step the page defines in
// window.qa, and saves one screenshot per step next to the page. Any request
// that leaves localhost or targets an API path fails the run: the pages use
// injected stub services only and never reach the live backend.
import {spawn} from 'node:child_process';
import {existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const CHROME = process.env.QA_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const ORIGIN = process.env.QA_ORIGIN || 'http://localhost:5173';
const BLOCKED_PATH = /^\/(api|manager|Manager|ext-api|ws|super-admin-api)(\/|$)/;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function runHarness({name, width = 1280, height = 900}) {
  const dir = fileURLToPath(new URL(`../${name}-qa/`, import.meta.url));
  const url = `${ORIGIN}/artifacts/${name}-qa/index.html`;
  const profile = mkdtempSync(join(tmpdir(), `rtx5-${name}-qa-`));
  const browser = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
  ], {windowsHide: true, stdio: 'ignore'});
  const summary = {harness: name, pass: false, steps: [], exceptions: [], consoleErrors: [], offPageRequests: [], screenshots: []};
  let socket, nextId = 1;
  const pending = new Map();
  const send = (method, params = {}, timeoutMs = 30000) => new Promise((resolve, reject) => {
    const id = nextId++;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, timeoutMs);
    pending.set(id, {resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); }});
    socket.send(JSON.stringify({id, method, params}));
  });
  try {
    let port;
    for (let i = 0; i < 200 && !port; i += 1) {
      const file = join(profile, 'DevToolsActivePort');
      if (existsSync(file)) port = Number(readFileSync(file, 'utf8').split(/\r?\n/)[0]) || undefined;
      if (!port) await pause(50);
    }
    if (!port) throw new Error('Chrome did not publish a debugging port');
    let target;
    for (let i = 0; i < 100 && !target; i += 1) {
      try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(page => page.type === 'page'); } catch { /* starting */ }
      if (!target) await pause(100);
    }
    if (!target) throw new Error('Chrome debug target did not start');
    socket = new WebSocket(target.webSocketDebuggerUrl);
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.method === 'Runtime.exceptionThrown') {
        const d = message.params.exceptionDetails;
        summary.exceptions.push(d.exception?.description || d.text);
      }
      if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
        summary.consoleErrors.push(message.params.args.map(arg => arg.value ?? arg.description ?? '').join(' ').slice(0, 300));
      }
      if (message.method === 'Network.requestWillBeSent') {
        const requestUrl = message.params.request.url;
        try {
          const parsed = new URL(requestUrl);
          const local = parsed.protocol === 'data:' || parsed.protocol === 'blob:' || (['localhost', '127.0.0.1'].includes(parsed.hostname) && String(parsed.port) === new URL(ORIGIN).port);
          if (!local || BLOCKED_PATH.test(parsed.pathname)) summary.offPageRequests.push(requestUrl);
        } catch { summary.offPageRequests.push(requestUrl); }
      }
      if (message.id && pending.has(message.id)) {
        const handler = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) handler.reject(new Error(message.error.message));
        else handler.resolve(message.result);
      }
    });
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, {once: true}); socket.addEventListener('error', reject, {once: true}); });
    await send('Runtime.enable');
    await send('Page.enable');
    await send('Network.enable');
    await send('Browser.setDownloadBehavior', {behavior: 'deny'}).catch(() => {});
    await send('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: false});
    await send('Page.navigate', {url});
    let steps;
    for (let i = 0; i < 200 && !steps; i += 1) {
      const response = await send('Runtime.evaluate', {expression: 'window.qa && window.qa.steps', returnByValue: true});
      steps = response.result.value;
      if (!steps) await pause(100);
    }
    if (!steps) throw new Error(`QA page did not load: ${JSON.stringify(summary.exceptions)}`);
    for (const [index, step] of steps.entries()) {
      const started = Date.now();
      const response = await send('Runtime.evaluate', {expression: `window.qa.run(${JSON.stringify(step)})`, awaitPromise: true, returnByValue: true}, 60000);
      const failed = response.exceptionDetails;
      const entry = {step, ok: !failed, ms: Date.now() - started};
      if (failed) entry.error = failed.exception?.description?.split('\n').slice(0, 3).join(' | ') || failed.text;
      else entry.result = response.result.value;
      await pause(120);
      const metrics = await send('Page.getLayoutMetrics');
      const contentHeight = Math.min(Math.ceil(metrics.cssContentSize?.height || height), 6000);
      const shot = await send('Page.captureScreenshot', {format: 'png', captureBeyondViewport: true, clip: {x: 0, y: 0, width, height: Math.max(height, contentHeight), scale: 1}});
      const file = `${String(index + 1).padStart(2, '0')}-${step}.png`;
      writeFileSync(join(dir, file), Buffer.from(shot.data, 'base64'));
      summary.screenshots.push(file);
      summary.steps.push(entry);
      if (failed) break;
    }
    summary.pass = summary.steps.length === steps.length && summary.steps.every(s => s.ok) && summary.exceptions.length === 0 && summary.offPageRequests.length === 0;
  } catch (error) {
    summary.error = error.message;
  } finally {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({id: nextId++, method: 'Browser.close'}));
      socket.close();
    }
    browser.kill();
    await pause(300);
    try { rmSync(profile, {recursive: true, force: true}); } catch { /* Chrome may still hold files */ }
  }
  writeFileSync(join(dir, 'result.json'), JSON.stringify(summary, null, 2));
  return summary;
}

export async function runFromCli(name, options) {
  const summary = await runHarness({name, ...options});
  console.log(JSON.stringify(summary, null, 2));
  process.exitCode = summary.pass ? 0 : 1;
}
