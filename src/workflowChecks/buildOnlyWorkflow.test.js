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

test('admin source image workflow is build and publish only', async () => {
  const workflow = await readFile(workflowUrl, 'utf8');

  for (const term of forbiddenDeploymentTerms) {
    assert.equal(workflow.includes(term), false, `workflow must not contain ${term}`);
  }

  assert.match(workflow, /Run tests[\s\S]*npm test/);
  assert.match(workflow, /id: build/);
  assert.match(workflow, /steps\.build\.outputs\.digest/);
  assert.match(workflow, /source_sha/);
  assert.match(workflow, /image_ref/);
});
