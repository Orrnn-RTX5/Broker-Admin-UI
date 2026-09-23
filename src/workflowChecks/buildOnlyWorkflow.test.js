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
  // The deploy runs after the release record and pins the image by commit SHA.
  assert.match(workflow, /Record immutable image release[\s\S]*Deploy to server/);
  assert.match(workflow, /NEW_IMAGE="\$\{\{ env\.IMAGE_NAME \}\}:\$\{\{ github\.sha \}\}"/);
  // Runtime config must survive container replacement.
  assert.match(workflow, /docker run[\s\S]*--env-file "\$ENV_FILE"[\s\S]*"\$NEW_IMAGE"/);
});
