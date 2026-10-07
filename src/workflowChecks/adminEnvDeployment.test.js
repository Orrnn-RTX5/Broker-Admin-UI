import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, chmodSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import yaml from 'js-yaml';
import { normalizeAdminEnv } from '../../scripts/prepare-admin-env.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const valid = [
  'VITE_BROKER_ID=example',
  'VITE_API_HOST=https://service.example.com',
  'VITE_FEED_WS_URL=wss://service.example.com/ws/feed',
  'VITE_FEED_STATUS_URL=https://service.example.com/ws/feed/status',
].join('\n');
const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash';

function temporary(t) {
  const dir = mkdtempSync(path.join(tmpdir(), 'admin-env-check-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('Actions env accepts VITE and runtime aliases, Windows lines, and comments', () => {
  const text = normalizeAdminEnv(`\uFEFF # deployment config\r\n\r\n${valid.replaceAll('\n', '\r\n')}\r\n`);
  assert.equal(text, `${valid}\n`);
  assert.equal(normalizeAdminEnv(valid.replaceAll('VITE_', '')), `${valid.replaceAll('VITE_', '')}\n`);
  assert.equal(normalizeAdminEnv(`${valid}\nFEED_WS_URL=\n`), `${valid}\nFEED_WS_URL=\n`);
  assert.doesNotThrow(() => normalizeAdminEnv(`${valid}\nFEED_WS_URL=wss://service.example.com/ws/feed`));
});

test('Actions env rejects missing, blank, duplicate, conflicting, and malformed definitions', () => {
  for (const raw of [undefined, '', ' \r\n', valid.replace('VITE_BROKER_ID=example', 'VITE_BROKER_ID='), valid.replace('VITE_FEED_WS_URL=wss://service.example.com/ws/feed', '')]) {
    assert.throws(() => normalizeAdminEnv(raw));
  }
  assert.throws(() => normalizeAdminEnv(`${valid}\nVITE_BROKER_ID=example`), /more than once/);
  assert.throws(() => normalizeAdminEnv(`${valid}\nFEED_WS_URL=wss://different.example.com/ws/feed`), /conflicting FEED_WS_URL/);
  assert.throws(() => normalizeAdminEnv(`${valid}\nexport HELLO=value`), /malformed entry/);
  assert.throws(() => normalizeAdminEnv(`${valid}\nnot a definition`), /malformed entry/);
});

test('Actions env rejects insecure, mismatched, linked, and wrong-path feed URLs without printing values', () => {
  for (const invalid of [
    valid.replace('https://service.example.com', 'http://service.example.com'),
    valid.replace('wss://', 'ws://'),
    valid.replace('wss://', 'wss:'),
    valid.replace('wss://', 'wss:\\'),
    valid.replace('https://service.example.com/ws/feed/status', 'https:service.example.com/ws/feed/status'),
    valid.replace('wss://service.example.com/ws/feed', '[wss://service.example.com/ws/feed](wss://service.example.com/ws/feed)'),
    valid.replace('/ws/feed/status', '/different/status'),
    valid.replace('https://service.example.com/ws/feed/status', 'https://other.example.com/ws/feed/status'),
    valid.replace('wss://service.example.com/ws/feed', 'wss://user:private-marker@service.example.com/ws/feed'),
  ]) {
    assert.throws(() => normalizeAdminEnv(invalid), (error) => !error.message.includes('private-marker') && !error.message.includes('service.example.com'));
  }
});

test('Actions preparation transports literal shell characters without evaluating them', (t) => {
  const dir = temporary(t);
  const marker = path.join(dir, 'must-not-exist').replaceAll('\\', '/');
  const raw = `${valid}\nBROKER_NAME=Bob's $HOME \`touch ${marker}\` $(touch ${marker})\n`;
  assert.equal(normalizeAdminEnv(raw), raw);
  const githubEnv = path.join(dir, 'github-env');
  writeFileSync(githubEnv, 'EXISTING=value\n');
  const result = spawnSync(process.execPath, ['scripts/prepare-admin-env.mjs'], {
    cwd: root,
    env: { ...process.env, ADMIN_UI_ENV: raw, GITHUB_ENV: githubEnv },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  const encoded = Buffer.from(raw).toString('base64');
  assert.equal(readFileSync(githubEnv, 'utf8'), `EXISTING=value\nADMIN_UI_ENV_B64=${encoded}\n`);
  assert.ok(result.stdout.includes(`::add-mask::${encoded}`));
  assert.equal(result.stdout.includes("Bob's"), false);
  assert.equal(existsSync(marker), false);
});

test('Actions preparation fails before writing env when required secret is absent', (t) => {
  const githubEnv = path.join(temporary(t), 'github-env');
  writeFileSync(githubEnv, 'EXISTING=value\n');
  const result = spawnSync(process.execPath, ['scripts/prepare-admin-env.mjs'], {
    cwd: root,
    env: { ...process.env, ADMIN_UI_ENV: '', GITHUB_ENV: githubEnv },
    encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /ADMIN_UI_ENV/);
  assert.equal(readFileSync(githubEnv, 'utf8'), 'EXISTING=value\n');
});

test('runtime entrypoint preserves the dedicated browser feed credential when configured', (t) => {
  const dir = temporary(t);
  const result = spawnSync(bash, [path.join(root, 'docker-entrypoint.sh').replaceAll('\\', '/'), 'true'], {
    cwd: root,
    env: { ...process.env, DIST_DIR: dir.replaceAll('\\', '/'), FEED_BROKER_TOKEN: '', VITE_FEED_BROKER_TOKEN: 'browser-feed-fixture' },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(readFileSync(path.join(dir, 'runtime-config.js'), 'utf8'), /FEED_BROKER_TOKEN: "browser-feed-fixture"/);
  assert.throws(() => normalizeAdminEnv(`${valid}\nFEED_BROKER_TOKEN=one\nVITE_FEED_BROKER_TOKEN=two`), /conflicting FEED_BROKER_TOKEN/);
});

function deploymentScript() {
  const workflow = yaml.load(readFileSync(path.join(root, '.github/workflows/ci-cd.yml'), 'utf8'));
  const deploy = Object.values(workflow.jobs).flatMap((job) => job.steps ?? []).find((step) => step.name === 'Deploy to server');
  assert.ok(deploy, 'workflow must include its deployment step');
  assert.match(deploy.with.envs, /ADMIN_UI_ENV_B64/);
  assert.equal(deploy.env.NEW_IMAGE, '${{ needs.publish-image.outputs.image_ref }}');
  return deploy.with.script_path ? readFileSync(path.join(root, deploy.with.script_path), 'utf8') : deploy.with.script;
}

function runDeployment(t, scenario, options = {}) {
  const dir = temporary(t);
  const bin = path.join(dir, 'bin');
  mkdirSync(bin);
  const unix = (value) => value.replaceAll('\\', '/');
  const containerName = options.containerName || 'broker-admin-ui';
  const envFile = path.join(dir, options.envPath || 'broker-admin-ui.env');
  mkdirSync(path.dirname(envFile), { recursive: true });
  const oldText = 'BROKER_ID=previous\nAPI_HOST=https://previous.example.com\nFEED_WS_URL=wss://previous.example.com/ws/feed\nFEED_STATUS_URL=https://previous.example.com/ws/feed/status\n';
  writeFileSync(envFile, oldText);
  const old = { id: 'original-container-id', image: 'sha256:original', running: true, envText: oldText, options: ['--network', 'original-network', '-p', '8080:80'], runtime: '' };
  const stateFile = path.join(dir, 'docker-state.json');
  writeFileSync(stateFile, JSON.stringify({ containers: { [containerName]: old }, calls: [], scenario }));
  writeFileSync(path.join(bin, 'docker'), '#!/bin/sh\nexec "$TEST_NODE" "$TEST_DOCKER_MOCK" "$@"\n');
  writeFileSync(path.join(bin, 'sleep'), '#!/bin/sh\nexit 0\n');
  // Git Bash has no flock; lock coordination belongs to Linux deployment checks.
  writeFileSync(path.join(bin, 'flock'), '#!/bin/sh\nif [ "$TEST_DEPLOY_SCENARIO" = "lock-held" ]; then exit 1; fi\nexit 0\n');
  chmodSync(path.join(bin, 'docker'), 0o755);
  chmodSync(path.join(bin, 'sleep'), 0o755);
  chmodSync(path.join(bin, 'flock'), 0o755);
  const marker = unix(path.join(dir, 'must-not-exist'));
  const text = normalizeAdminEnv(`${valid}\nBROKER_NAME=Bob's $HOME \`touch ${marker}\` $(touch ${marker})\n`);
  const scriptFile = path.join(dir, 'deploy.sh');
  writeFileSync(scriptFile, deploymentScript());
  const result = spawnSync(bash, [unix(scriptFile)], {
    cwd: root,
    env: { ...process.env, HOME: unix(dir), PATH: `${unix(bin)}${path.delimiter}${process.env.PATH}`, ADMIN_UI_ENV_B64: Buffer.from(text).toString('base64'), NEW_IMAGE: 'ghcr.io/example/admin@sha256:1234567890', GHCR_TOKEN: 'fixture-token', GHCR_USERNAME: 'fixture-user', TEST_NODE: unix(process.execPath), TEST_DOCKER_MOCK: unix(path.join(root, 'src/workflowChecks/fixtures/adminDockerMock.cjs')), TEST_DOCKER_STATE: stateFile, TEST_PROJECT_ROOT: root, TEST_BASH_PATH: bash, TEST_DEPLOY_SCENARIO: scenario, ADMIN_CONTAINER_NAME: options.containerName || '', ADMIN_PORT_MAPPING: options.portMapping || '', ADMIN_UI_ENV_FILE: options.envPath ? unix(envFile) : '' },
    encoding: 'utf8', timeout: 120000,
  });
  assert.equal(result.error, undefined, result.error?.message);
  const state = JSON.parse(readFileSync(stateFile, 'utf8'));
  assert.equal(existsSync(marker), false, 'env values must never be shell sourced');
  return { result, state, envFile, old, oldText, text, containerName };
}

test('remote deployment installs secret env and verifies entrypoint output before saving it', (t) => {
  const { result, state, envFile, text } = runDeployment(t, 'success');
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.equal(state.containers['broker-admin-ui'].image, 'ghcr.io/example/admin@sha256:1234567890');
  assert.equal(state.containers['broker-admin-ui'].envText, text);
  assert.equal(readFileSync(envFile, 'utf8'), text);
  assert.deepEqual(Object.keys(state.containers), ['broker-admin-ui']);
  assert.ok(state.calls.some((args) => args[0] === 'exec'), 'generated runtime configuration must be checked');
});

for (const scenario of ['startup-failure', 'readiness-failure', 'runtime-mismatch']) {
  test(`remote deployment restores original container and env after ${scenario}`, (t) => {
    const { result, state, envFile, old, oldText } = runDeployment(t, scenario);
    assert.notEqual(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.deepEqual(state.containers['broker-admin-ui'], old, 'rollback must restart the original container with its exact configuration');
    assert.equal(readFileSync(envFile, 'utf8'), oldText, 'failed config must not replace last working env file');
    assert.deepEqual(Object.keys(state.containers), ['broker-admin-ui']);
    assert.ok(state.calls.some((args) => args[0] === 'start'), 'rollback must restart retained old container');
  });
}

test('remote deployment leaves the running container untouched when another deployment holds the lock', (t) => {
  const { result, state, envFile, old, oldText } = runDeployment(t, 'lock-held');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /already running/);
  assert.deepEqual(state.containers['broker-admin-ui'], old);
  assert.equal(readFileSync(envFile, 'utf8'), oldText);
  assert.deepEqual(state.calls, [], 'lock contention must fail before any Docker operation');
});

test('remote deployment uses configured container, port mapping, and runtime file', (t) => {
  const options = { containerName: 'configured-admin', portMapping: '127.0.0.1:9081:80', envPath: 'deployment/runtime.env' };
  const { result, state, envFile, text, containerName } = runDeployment(t, 'success', options);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.deepEqual(Object.keys(state.containers), [containerName]);
  assert.equal(state.containers[containerName].envText, text);
  const runArgs = state.calls.find((args) => args[0] === 'run');
  assert.equal(runArgs[runArgs.indexOf('-p') + 1], options.portMapping);
  assert.equal(readFileSync(envFile, 'utf8'), text);
});
