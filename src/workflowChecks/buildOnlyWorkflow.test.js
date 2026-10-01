import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

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

test('admin workflow publishes an immutable image before deploying it', async () => {
  const workflow = await readFile(workflowUrl, 'utf8');

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
  assert.match(workflow, /Prepare admin runtime environment[\s\S]*Build and push image/);
  assert.match(workflow, /envs: ADMIN_UI_ENV_B64,NEW_IMAGE,GHCR_TOKEN,GHCR_USERNAME/);
  assert.match(workflow, /script_path: scripts\/deploy-admin-runtime\.sh/);
  assert.match(workflow, /cancel-in-progress: false/);

  const deployment = await readFile(new URL('../../scripts/deploy-admin-runtime.sh', import.meta.url), 'utf8');
  assert.match(deployment, /docker run[\s\S]*--env-file "\$ENV_FILE"[\s\S]*"\$NEW_IMAGE"/);
  assert.doesNotMatch(deployment, /\$\{\{ secrets\./);
});
