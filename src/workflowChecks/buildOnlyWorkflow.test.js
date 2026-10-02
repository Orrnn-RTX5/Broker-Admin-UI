import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import yaml from 'js-yaml';

const workflowUrl = new URL('../../.github/workflows/ci-cd.yml', import.meta.url);
const forbiddenDeploymentTerms = [
  'BROKER_IDS',
  'BROKER_SSH_PRIVATE_KEY',
  'INFRA_REPO_DISPATCH_TOKEN',
  'deploy-broker.sh',
  'ssh ',
  'scp ',
  'repository_dispatch',
];

test('admin workflow builds candidates and promotes only the frozen Nexa image on main', async () => {
  const workflow = await readFile(workflowUrl, 'utf8');
  const parsed = yaml.load(workflow);
  const steps = parsed.jobs['publish-image'].steps;
  const named = (name) => steps.find((step) => step.name === name);

  for (const term of forbiddenDeploymentTerms) {
    assert.equal(workflow.includes(term), false, `workflow must not contain ${term}`);
  }

  assert.match(workflow, /Run tests[\s\S]*npm test/);
  assert.match(workflow, /id: build/);
  assert.match(workflow, /steps\.build\.outputs\.digest/);
  assert.match(workflow, /source_sha/);
  assert.match(workflow, /image_ref/);
  // The deploy uses the digest recorded for the exact image that was published.
  assert.match(workflow, /Record immutable image release[\s\S]*Deploy to server/);
  assert.match(workflow, /NEW_IMAGE: \$\{\{ steps\.release_record\.outputs\.image_ref \}\}/);
  assert.match(workflow, /ADMIN_UI_ENV: \$\{\{ secrets\.ADMIN_UI_ENV \}\}/);
  assert.deepEqual(parsed.on.push.branches, ['main', 'release-candidate/**']);
  assert.equal(named('Build and push image').if, "startsWith(github.ref, 'refs/heads/release-candidate/')");
  assert.equal(named('Build and push image').with.labels, 'org.opencontainers.image.revision=${{ github.sha }}');
  assert.equal(named('Setup Docker Buildx').if, named('Build and push image').if);
  assert.equal(named('Prepare admin runtime environment').if, undefined);
  assert.ok(steps.indexOf(named('Prepare admin runtime environment')) < steps.indexOf(named('Read-only deployment target inventory')));
  assert.ok(steps.indexOf(named('Read-only deployment target inventory')) < steps.indexOf(named('Build and push image')));
  assert.equal(named('Verify Nexa validated release inputs').if, "github.ref == 'refs/heads/main'");
  assert.equal(named('Deploy to server').if, "github.ref == 'refs/heads/main'");
  assert.ok(steps.indexOf(named('Verify Nexa validated release inputs')) < steps.indexOf(named('Deploy to server')));
  assert.match(workflow, /envs: ADMIN_UI_ENV_B64,NEW_IMAGE,GHCR_TOKEN,GHCR_USERNAME/);
  assert.match(workflow, /script_path: scripts\/deploy-admin-runtime\.sh/);
  assert.match(workflow, /cancel-in-progress: false/);

  const deployment = await readFile(new URL('../../scripts/deploy-admin-runtime.sh', import.meta.url), 'utf8');
  assert.match(deployment, /docker run[\s\S]*--env-file "\$ENV_FILE"[\s\S]*"\$NEW_IMAGE"/);
  assert.doesNotMatch(deployment, /\$\{\{ secrets\./);
});

test('candidate target inventory reads metadata without replacing containers or exposing environment contents', async () => {
  const parsed = yaml.load(await readFile(workflowUrl, 'utf8'));
  const step = parsed.jobs['publish-image'].steps.find((entry) => entry.name === 'Read-only deployment target inventory');
  assert.equal(step.if, "startsWith(github.ref, 'refs/heads/release-candidate/')");
  assert.match(step.with.script, /docker ps/);
  assert.match(step.with.script, /docker inspect/);
  assert.match(step.with.script, /NETWORKS=\{\{json \.NetworkSettings\.Networks\}\}/);
  assert.doesNotMatch(step.with.script, /\.Config\.Env|docker (run|exec|rm|start|stop|login|pull)|cat .*env/);
  assert.match(step.with.script, /server_name\|listen/);
  assert.match(step.with.script, /proxy_pass/);
});

test('main promotion rejects missing, wrong-source, wrong-image and wrong-label inputs before deployment', async (t) => {
  const parsed = yaml.load(await readFile(workflowUrl, 'utf8'));
  const gate = parsed.jobs['publish-image'].steps.find((entry) => entry.name === 'Verify Nexa validated release inputs');
  const dir = mkdtempSync(path.join(tmpdir(), 'admin-release-gate-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash';
  const sha = 'a'.repeat(40);
  const imageName = 'ghcr.io/orrnn-rtx5/broker-admin-ui';
  const image = `${imageName}@sha256:${'b'.repeat(64)}`;
  const cases = [
    { source: '', image, revision: sha, accepted: false, dockerCalls: 0 },
    { source: 'c'.repeat(40), image, revision: sha, accepted: false, dockerCalls: 0 },
    { source: sha, image: 'ghcr.io/other/admin@sha256:' + 'b'.repeat(64), revision: sha, accepted: false, dockerCalls: 0 },
    { source: sha, image: `${imageName}:latest`, revision: sha, accepted: false, dockerCalls: 0 },
    { source: sha, image: `${image}extra`, revision: sha, accepted: false, dockerCalls: 0 },
    { source: sha, image, revision: 'c'.repeat(40), accepted: false, dockerCalls: 2 },
    { source: sha, image, revision: sha, accepted: true, dockerCalls: 2 },
  ];
  for (const [index, entry] of cases.entries()) {
    const log = path.join(dir, `docker-${index}.log`).replaceAll('\\', '/');
    const mock = 'docker() { printf "%s\\n" "$*" >> "$TEST_DOCKER_LOG"; if [ "$1" = pull ]; then return 0; fi; printf "%s" "$TEST_IMAGE_REVISION"; }\n';
    const result = spawnSync(bash, ['-s'], {
      input: mock + gate.run,
      env: { ...process.env, IMAGE_NAME: imageName, GITHUB_SHA: sha, ADMIN_RELEASE_SOURCE_SHA: entry.source, ADMIN_RELEASE_IMAGE_REF: entry.image, TEST_IMAGE_REVISION: entry.revision, TEST_DOCKER_LOG: log },
      encoding: 'utf8',
      windowsHide: true,
      timeout: 10000,
    });
    assert.equal(result.status === 0, entry.accepted, `case ${index}: ${result.stderr || result.error || ''}`);
    let calls = [];
    try { calls = readFileSync(log, 'utf8').trim().split('\n'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    assert.equal(calls.length, entry.dockerCalls, `case ${index} Docker calls`);
    if (entry.accepted) assert.equal(calls[0], `pull ${image}`);
  }
});
