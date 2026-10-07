import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import yaml from 'js-yaml';

const workflowUrl = new URL('../../.github/workflows/ci-cd.yml', import.meta.url);

test('main and manual releases build their own image without broker approval inputs', async () => {
  const text = await readFile(workflowUrl, 'utf8');
  const workflow = yaml.load(text);
  const publish = workflow.jobs['publish-image'];
  const build = publish.steps.find((step) => step.id === 'build');
  assert.deepEqual(workflow.on.push.branches, ['main', 'release-candidate/**']);
  assert.equal(publish.if, "github.event_name == 'push' || github.event_name == 'workflow_dispatch'");
  assert.equal(publish.needs, undefined);
  assert.equal(build.if, undefined);
  assert.equal(build.with.push, true);
  assert.equal(build.with.labels, 'org.opencontainers.image.revision=${{ github.sha }}');
  assert.match(publish.steps.find((step) => step.id === 'release_record').run, /image_ref="\$\{IMAGE_NAME\}@\$\{IMAGE_DIGEST\}"/);
  assert.doesNotMatch(text, /Nexa|ADMIN_RELEASE_SOURCE_SHA|ADMIN_RELEASE_IMAGE_REF|npm test|Read-only deployment target inventory/);
  assert.equal(workflow.jobs.validate.if, "github.event_name == 'pull_request'");
  assert.ok(workflow.jobs.validate.steps.some((step) => step.run === 'npm run build'));
});

test('broker deployments use the selected environment and the published digest', async () => {
  const workflow = yaml.load(await readFile(workflowUrl, 'utf8'));
  const input = workflow.on.workflow_dispatch.inputs.environment;
  const deploy = workflow.jobs.deploy;
  assert.equal(input.type, 'environment');
  assert.equal(input.default, 'production');
  assert.equal(input.required, true);
  assert.equal(deploy.environment, "${{ inputs.environment || 'production' }}");
  assert.equal(deploy.if, "github.event_name == 'workflow_dispatch' || github.ref == 'refs/heads/main'");
  assert.equal(deploy.needs, 'publish-image');
  assert.equal(deploy.concurrency.group, "admin-deploy-${{ inputs.environment || 'production' }}");
  assert.equal(deploy.concurrency['cancel-in-progress'], false);
  const step = deploy.steps.find((entry) => entry.name === 'Deploy to server');
  assert.equal(step.env.NEW_IMAGE, '${{ needs.publish-image.outputs.image_ref }}');
  assert.equal(step.with.host, '${{ secrets.SERVER_HOST }}');
  assert.equal(step.with.script_path, 'scripts/deploy-admin-runtime.sh');
  assert.match(step.with.envs, /ADMIN_UI_ENV_B64,NEW_IMAGE/);
  assert.ok(deploy.steps.some((entry) => entry.env?.ADMIN_UI_ENV === '${{ secrets.ADMIN_UI_ENV }}'));
});
