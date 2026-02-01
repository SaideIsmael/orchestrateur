import { execa } from 'execa';

const childProcesses = [];

const shutdown = () => {
  for (const child of childProcesses) {
    if (!child.killed) {
      child.kill('SIGTERM', { forceKillAfterTimeout: 2000 });
    }
  }
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

const vite = execa('vite', ['--config', 'vite.config.ts'], { stdio: 'inherit' });
const tsc = execa('tsc', ['-p', 'tsconfig.main.json', '-w', '--preserveWatchOutput'], {
  stdio: 'inherit'
});

childProcesses.push(vite, tsc);

await new Promise((resolve) => setTimeout(resolve, 2000));

const electron = execa('electron', ['.'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    VITE_DEV_SERVER_URL: 'http://localhost:5173'
  }
});

childProcesses.push(electron);

try {
  await electron;
} finally {
  shutdown();
}