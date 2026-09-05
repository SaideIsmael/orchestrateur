import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';

const PROJECT_ROOT = path.join(__dirname, '..', '..');
const MAIN_ENTRY = path.join(PROJECT_ROOT, 'dist', 'main', 'main.js');

export type LaunchedApp = {
  app: ElectronApplication;
  mainPage: Page;
  userDataDir: string;
  providersConfigPath: string;
};

export type LaunchOptions = {
  providers: Array<{
    id: string;
    name: string;
    url_home: string;
    allowlist: string[];
  }>;
  userDataDir?: string;
};

/**
 * Lance l'application reelle (build de production, pas le serveur Vite dev)
 * avec une config providers.json isolee et un userData dedie, pour des
 * tests de bout en bout hermetiques et reproductibles.
 */
export async function launchApp(options: LaunchOptions): Promise<LaunchedApp> {
  if (!fs.existsSync(MAIN_ENTRY)) {
    throw new Error(
      `${MAIN_ENTRY} introuvable. Lancez "npm run build" avant les tests E2E.`
    );
  }

  const userDataDir = options.userDataDir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'orchestrateur-e2e-'));
  const providersConfigPath = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'orchestrateur-e2e-config-')),
    'providers.json'
  );
  fs.writeFileSync(providersConfigPath, JSON.stringify(options.providers, null, 2), 'utf8');

  const app = await electron.launch({
    args: [MAIN_ENTRY, `--user-data-dir=${userDataDir}`],
    env: {
      ...process.env,
      ORCH_PROVIDERS_CONFIG_PATH: providersConfigPath
    }
  });

  const mainPage = await app.firstWindow();
  await mainPage.waitForLoadState('domcontentloaded');

  return { app, mainPage, userDataDir, providersConfigPath };
}
