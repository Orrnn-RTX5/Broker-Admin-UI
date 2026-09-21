import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const profile = mkdtempSync(join(tmpdir(), 'rtx5-groups-qa-'));
const browser = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=9237', `--user-data-dir=${profile}`, 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
let socket;
let nextId = 1;
const pending = new Map();
const exceptions = [];
const qaUrl = process.argv[2] || 'http://localhost:5173/artifacts/groups-navigation-qa/index.html';
const qaFunction = process.argv[3] || 'runGroupsCheck';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = nextId++;
  const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 25000);
  pending.set(id, { resolve: result => { clearTimeout(timeout); resolve(result); }, reject });
  socket.send(JSON.stringify({ id, method, params }));
});
try {
  let target;
  for (let i = 0; i < 100; i += 1) {
    try {
      const pages = await (await fetch('http://localhost:9237/json/list')).json();
      target = pages.find(page => page.type === 'page');
      if (target) break;
    } catch { /* browser is starting */ }
    await pause(100);
  }
  assert.ok(target, 'Chrome debug target must start');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails);
    if (pending.has(message.id)) {
      const handler = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) handler.reject(new Error(message.error.message));
      else handler.resolve(message.result);
    }
  });
  await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: qaFunction === 'runExplorerCheck' ? 1400 : 440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: qaUrl });
  let ready = false;
  for (let i = 0; i < 120; i += 1) {
    const response = await send('Runtime.evaluate', { expression: `typeof window[${JSON.stringify(qaFunction)}] === "function"`, returnByValue: true });
    if (response.result.value) { ready = true; break; }
    await pause(100);
  }
  assert.ok(ready, `QA page did not load: ${JSON.stringify(exceptions)}`);
  const result = await send('Runtime.evaluate', { expression: `window[${JSON.stringify(qaFunction)}]()`, awaitPromise: true, returnByValue: true });
  assert.ok(!result.exceptionDetails, JSON.stringify(result.exceptionDetails));
  assert.equal(exceptions.length, 0, JSON.stringify(exceptions));
  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(new URL(qaFunction === 'runExplorerCheck' ? '../groups-explorer-qa/groups-explorer.png' : './groups-tree.png', import.meta.url), Buffer.from(screenshot.data, 'base64'));
  console.log(JSON.stringify(result.result.value));
} finally {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ id: nextId++, method: 'Browser.close' }));
    socket.close();
  }
  browser.kill();
}
