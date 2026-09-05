import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { startFixtureServer, type FixtureServer } from './helpers/fixtureServer';
import { launchApp } from './helpers/launchApp';

let server: FixtureServer;
let userDataDir: string;

test.beforeAll(async () => {
  server = await startFixtureServer();
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestrateur-e2e-restore-'));
});

test.afterAll(async () => {
  await server.close();
});

test('restaure la liste des fournisseurs ouverts apres redemarrage', async () => {
  const providers = [
    {
      id: 'local-test',
      name: 'Local Test',
      url_home: `${server.baseUrl}/home.html`,
      allowlist: ['127.0.0.1']
    }
  ];

  const first = await launchApp({ providers, userDataDir });
  await first.mainPage.getByRole('button', { name: 'Local Test' }).click();
  await expect
    .poll(() => first.app.windows().length, { timeout: 10000 })
    .toBeGreaterThan(1);
  // Laisse le temps a saveState() (declenche par provider:open) d'ecrire
  // effectivement state.enc avant de fermer l'application.
  await first.mainPage.waitForTimeout(300);
  await first.app.close();

  const second = await launchApp({ providers, userDataDir });
  const openedOption = second.mainPage.locator(
    'select option',
    { hasText: 'Local Test' }
  );

  await expect(openedOption).toHaveCount(1);
  await second.app.close();
});
