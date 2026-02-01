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

const rootDir = process.cwd();
const nodeBin = process.execPath;
const viteBin = path.join(rootDir, 'node_modules', 'vite', 'bin', 'vite.js');
const tscBin = path.join(
  rootDir,
  'node_modules',
  'typescript',
  'bin',
  'tsc'
);
const electronBin = path.join(
  rootDir,
  'node_modules',
  'electron',
  'cli.js'
);

const vite = execa(nodeBin, [viteBin, '--config', 'vite.config.ts'], {
  stdio: 'inherit'
});
const tsc = execa(
  nodeBin,
  [tscBin, '-p', 'tsconfig.main.json', '-w', '--preserveWatchOutput'],
  { stdio: 'inherit' }
);

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

const mainOutDir = path.join(rootDir, 'dist', 'main');
const mainEntry = path.join(mainOutDir, 'main.js');
const preloadEntry = path.join(mainOutDir, 'preload.js');

await waitForFile(mainEntry, 30000);
await waitForFile(preloadEntry, 30000);

const waitForUrl = async (url, timeoutMs) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1500);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (response.ok) {
        return true;
      }
    } catch {
      // ignore until timeout
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return false;
};

const devUrl = process.env.VITE_DEV_SERVER_URL ?? 'http://localhost:5173';
await waitForUrl(devUrl, 30000);

const electron = execa(nodeBin, [electronBin, '.'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    VITE_DEV_SERVER_URL: devUrl
  }
});

childProcesses.push(electron);

try {
  await electron;
} finally {
  shutdown();
}
