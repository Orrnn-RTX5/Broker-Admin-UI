const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const stateFile = process.env.TEST_DOCKER_STATE;
const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
const args = process.argv.slice(2);
state.calls.push(args);
const save = () => fs.writeFileSync(stateFile, JSON.stringify(state));
const fail = (message) => { save(); process.stderr.write(`${message}\n`); process.exit(1); };
const valueAfter = (flag) => args[args.indexOf(flag) + 1];
const name = args.at(-1);
const config = (text) => Object.fromEntries(text.split('\n').filter((line) => line && !line.startsWith('#')).map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
const runtimeEnv = (text, dist) => {
  const clean = { ...process.env };
  for (const field of ['BROKER_ID', 'BROKER_NAME', 'API_HOST', 'API_HOST_EXT', 'FEED_WS_URL', 'FEED_STATUS_URL']) {
    delete clean[field];
    delete clean[`VITE_${field}`];
  }
  return { ...clean, ...config(text), DIST_DIR: dist.replaceAll('\\', '/') };
};

switch (args[0]) {
  case 'login':
  case 'pull':
    break;
  case 'inspect': {
    const container = state.containers[name];
    if (!container) fail('fixture: no such container');
    const format = args.includes('-f') ? valueAfter('-f') : args.includes('--format') ? valueAfter('--format') : '';
    if (format.includes('.State.Running')) process.stdout.write(String(container.running));
    else if (format.includes('.Config.Image')) process.stdout.write(container.image);
    else if (format.includes('.State.Health.Status')) process.stdout.write('healthy');
    else process.stdout.write(JSON.stringify([container]));
    break;
  }
  case 'stop':
    if (!state.containers[name]) fail('fixture: missing container to stop');
    state.containers[name].running = false;
    break;
  case 'start':
    if (!state.containers[name]) fail('fixture: missing container to start');
    state.containers[name].running = true;
    break;
  case 'rename': {
    const [, previous, next] = args;
    if (!state.containers[previous]) fail('fixture: missing container to rename');
    if (state.containers[next]) fail('fixture: destination already exists');
    state.containers[next] = state.containers[previous];
    delete state.containers[previous];
    break;
  }
  case 'rm':
    delete state.containers[name];
    break;
  case 'run': {
    if (state.scenario === 'startup-failure') fail('fixture: candidate could not start');
    const containerName = valueAfter('--name');
    const envText = fs.readFileSync(valueAfter('--env-file'), 'utf8');
    const dist = path.join(path.dirname(stateFile), 'candidate-dist');
    fs.mkdirSync(dist, { recursive: true });
    const entrypoint = path.join(process.env.TEST_PROJECT_ROOT, 'docker-entrypoint.sh').replaceAll('\\', '/');
    const generated = spawnSync(process.env.TEST_BASH_PATH, [entrypoint, 'true'], { env: runtimeEnv(envText, dist), encoding: 'utf8' });
    if (generated.status !== 0) fail(`fixture: real entrypoint failed: ${generated.stderr}`);
    const runtimeFile = path.join(dist, 'runtime-config.js');
    if (state.scenario === 'runtime-mismatch') {
      fs.writeFileSync(runtimeFile, fs.readFileSync(runtimeFile, 'utf8').replace('FEED_WS_URL: "wss://service.example.com/ws/feed"', 'FEED_WS_URL: ""'));
    }
    state.containers[containerName] = { id: 'candidate-container-id', image: args.at(-1), running: true, envText, options: args.slice(1, -1), dist };
    process.stdout.write('candidate-container-id\n');
    break;
  }
  case 'exec': {
    let index = 1;
    while (args[index]?.startsWith('-')) index++;
    const container = state.containers[args[index++]];
    if (!container || !container.running) fail('fixture: exec requires a running container');
    const command = args.slice(index);
    if (command[0] !== 'node' || command[1] !== '-e') fail(`fixture: unsupported exec command ${command.join(' ')}`);
    const fetch = `globalThis.fetch = async () => ({ ok: ${state.scenario !== 'readiness-failure'}, status: ${state.scenario === 'readiness-failure' ? 503 : 200} });\n`;
    const executed = spawnSync(process.execPath, ['-e', fetch + command[2]], {
      env: runtimeEnv(container.envText, container.dist),
      encoding: 'utf8',
    });
    save();
    process.stdout.write(executed.stdout);
    process.stderr.write(executed.stderr);
    process.exit(executed.status ?? 1);
    break;
  }
  case 'image':
    break;
  default:
    fail(`fixture: unsupported docker invocation: ${args.join(' ')}`);
}
save();
