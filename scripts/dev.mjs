import { execa } from 'execa';
import fs from 'node:fs';
import path from 'node:path';

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

const waitForFile = async (filePath, timeoutMs) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (fs.existsSync(filePath)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
};

const mainOutDir = path.join(process.cwd(), 'dist', 'main');
const mainEntry = path.join(mainOutDir, 'main.js');
const preloadEntry = path.join(mainOutDir, 'preload.js');

await waitForFile(mainEntry, 30000);
await waitForFile(preloadEntry, 30000);

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
