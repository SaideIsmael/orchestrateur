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

test('ouvre un fournisseur autorise et charge sa page', async () => {
  const { mainPage, app } = launched;

  await mainPage.getByRole('button', { name: 'Local Test' }).click();

  await expect
    .poll(() => app.windows().length, { timeout: 10000 })
    .toBeGreaterThan(1);

  const providerPage = app
    .windows()
    .find((page) => page.url().includes('/home.html'));

  expect(providerPage).toBeTruthy();
  await expect(providerPage!.locator('#marker')).toHaveText('FIXTURE_HOME_OK');

  await expect(mainPage.locator('.nav-url')).toContainText('/home.html');
});
