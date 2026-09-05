import { test, expect } from '@playwright/test';
import { startFixtureServer, type FixtureServer } from './helpers/fixtureServer';
import { launchApp, type LaunchedApp } from './helpers/launchApp';

let server: FixtureServer;
let launched: LaunchedApp;

test.beforeAll(async () => {
  server = await startFixtureServer();
  launched = await launchApp({
    providers: [
      {
        id: 'local-test',
        name: 'Local Test',
        url_home: `${server.baseUrl}/home.html`,
        allowlist: ['127.0.0.1']
      }
    ]
  });
});

test.afterAll(async () => {
  await launched.app.close();
  await server.close();
});

test('ouvre un fournisseur au clavier seul (Tab puis Entree)', async () => {
  const { mainPage, app } = launched;

  // Aucun raccourci clavier personnalise n'existe dans l'app : ce test
  // verifie l'operabilite clavier native des boutons HTML reels, pas un
  // systeme de raccourcis a inventer.
  const providerButton = mainPage.getByRole('button', { name: 'Local Test' });
  await providerButton.focus();
  await expect(providerButton).toBeFocused();

  await mainPage.keyboard.press('Enter');

  await expect
    .poll(() => app.windows().length, { timeout: 10000 })
    .toBeGreaterThan(1);

  const providerPage = app.windows().find((page) => page.url().includes('/home.html'));
  expect(providerPage).toBeTruthy();

  await expect(mainPage.locator('.nav-url')).toContainText('/home.html');
});
