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

test('bloque la navigation vers un domaine hors liste blanche', async () => {
  const { mainPage, app } = launched;

  await mainPage.getByRole('button', { name: 'Local Test' }).click();
  await expect
    .poll(() => app.windows().length, { timeout: 10000 })
    .toBeGreaterThan(1);

  const providerPage = app.windows().find((page) => page.url().includes('/home.html'))!;

  // dispatchEvent plutot que click() : Playwright reste bloque indefiniment
  // sur un clic qui declenche une navigation qu'Electron annule via
  // will-navigate + preventDefault (l'annulation cote Electron ne resout
  // jamais proprement le suivi de navigation interne de Playwright/CDP).
  await providerPage.locator('#blocked-link').dispatchEvent('click');

  await expect(mainPage.locator('.toast.warning')).toContainText(
    'Navigation bloquee',
    { timeout: 5000 }
  );

  // La navigation doit avoir ete reellement empechee, pas seulement notifiee.
  // evaluate() plutot qu'un locator : apres un will-navigate annule par
  // Electron, Playwright considere la page comme "en cours de navigation"
  // indefiniment et tout locator auto-attendant reste bloque.
  const markerText = await providerPage.evaluate(
    () => document.querySelector('#marker')?.textContent
  );
  expect(markerText).toBe('FIXTURE_HOME_OK');
  expect(providerPage.url()).toContain('/home.html');
});
