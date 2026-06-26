import { spawn } from 'node:child_process';
import electronPath from 'electron';

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronPath, ['.'], {
  stdio: 'inherit',
  env,
  windowsHide: false,
});

const forwardSignal = (signal) => {
  process.on(signal, () => {
    if (!child.killed) child.kill(signal);
  });
};

forwardSignal('SIGINT');
forwardSignal('SIGTERM');

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
