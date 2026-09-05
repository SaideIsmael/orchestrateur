import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { autoUpdater } from 'electron-updater';
import { BrowserViewManager } from './browserViewManager';
import { getProvidersConfigPath, loadProvidersConfig } from './providersStore';
import { loadState, saveState } from './stateStore';
import type { ProviderDefinition } from '../shared/providers';
import type { OrchestratorState } from '../shared/state';
import { defaultState } from '../shared/state';

import { registerAppIpc } from './ipc/app';
import { registerProvidersIpc } from './ipc/providers';
import { registerNavigationIpc } from './ipc/navigation';
import { registerSettingsIpc } from './ipc/settings';
import { registerViewIpc } from './ipc/view';
import { logger } from './log';

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const isDev = !app.isPackaged && Boolean(DEV_SERVER_URL);
const FALLBACK_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

let providersCache: ProviderDefinition[] = [];
let viewManager: BrowserViewManager | null = null;
let configErrors: string[] | null = null;
let orchestratorState: OrchestratorState = { ...defaultState };

function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1000,
    minHeight: 700,
    backgroundColor: '#0b0f1a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webviewTag: false,
      safeDialogs: true,
      enableRemoteModule: false
    } as Electron.WebPreferences
  });

  return mainWindow;
}

function loadRenderer(mainWindow: BrowserWindow) {
  if (isDev && DEV_SERVER_URL) {
    const loadResult = mainWindow.loadURL(DEV_SERVER_URL);
    if (loadResult && typeof loadResult.catch === 'function') {
      loadResult.catch((error) => {
        logger.main.error('Failed to load dev server:', error);
      });
    }
    if (process.env.ORCH_DEVTOOLS === '1') {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  } else {
    const loadResult = mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    if (loadResult && typeof loadResult.catch === 'function') {
      loadResult.catch((error) => {
        logger.main.error('Failed to load renderer:', error);
      });
    }
  }
}

function setupAutoUpdater(mainWindow: BrowserWindow) {
  if (!app.isPackaged) {
    return;
  }

  const notify = (message: string) => {
    mainWindow.webContents.send('ui:notification', { level: 'info', message });
  };

  autoUpdater.logger = logger.main;

  autoUpdater.on('update-available', (info) => {
    logger.main.info('Mise a jour disponible:', info.version);
    notify(`Mise a jour disponible (${info.version}), telechargement en cours...`);
  });

  autoUpdater.on('update-downloaded', (info) => {
    logger.main.info('Mise a jour telechargee:', info.version);
    notify(`Mise a jour ${info.version} prete. Elle sera installee au prochain redemarrage.`);
  });

  autoUpdater.on('error', (error) => {
    logger.main.error('Erreur de mise a jour automatique:', error);
  });

  autoUpdater.checkForUpdatesAndNotify().catch((error) => {
    logger.main.error('Verification de mise a jour impossible:', error);
  });
}

function renderConfigErrorHtml(errors: string[], configPath: string) {
  const errorItems = errors.map((error) => `<li>${error}</li>`).join('');
  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Configuration invalide</title>
    <style>
      body { font-family: "Segoe UI", sans-serif; background: #0f172a; color: #e2e8f0; padding: 32px; }
      .card { max-width: 720px; background: #1e293b; border-radius: 16px; padding: 24px; }
      h1 { margin-top: 0; font-size: 22px; }
      ul { padding-left: 20px; }
      code { background: #0f172a; padding: 2px 6px; border-radius: 6px; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Configuration providers.json invalide</h1>
      <p>Corrigez le fichier suivant puis relancez l'application :</p>
      <p><code>${configPath}</code></p>
      <ul>${errorItems}</ul>
    </div>
  </body>
</html>`;
}

app.whenReady().then(() => {
  registerAppIpc(() => viewManager);

  const mainWindow = createMainWindow();
  const providersResult = loadProvidersConfig();
  orchestratorState = loadState();

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDesc, url) => {
    const html = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Chargement impossible</title>
    <style>
      body { font-family: "Segoe UI", sans-serif; background: #0f172a; color: #e2e8f0; padding: 32px; }
      .card { max-width: 720px; background: #1e293b; border-radius: 16px; padding: 24px; }
      h1 { margin-top: 0; font-size: 22px; }
      code { background: #0f172a; padding: 2px 6px; border-radius: 6px; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Impossible de charger l'interface</h1>
      <p>Erreur: <strong>${errorDesc}</strong> (code ${errorCode}).</p>
      <p>URL: <code>${url}</code></p>
      <p>Si vous etes en dev, assurez-vous que Vite tourne sur ${DEV_SERVER_URL ?? 'http://localhost:5173'}.</p>
    </div>
  </body>
</html>`;
    mainWindow.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(html)}`);
  });

  if (!providersResult.ok) {
    configErrors = providersResult.errors;
    const html = renderConfigErrorHtml(
      providersResult.errors,
      getProvidersConfigPath()
    );
    mainWindow.loadURL(
      `data:text/html;charset=UTF-8,${encodeURIComponent(html)}`
    );
    return;
  }

  configErrors = null;
  providersCache = providersResult.providers;
  viewManager = new BrowserViewManager(mainWindow, FALLBACK_USER_AGENT);

  const getOpenedProviders = () =>
    orchestratorState.openedProviders
      .map((id) => providersCache.find((provider) => provider.id === id))
      .filter((provider): provider is ProviderDefinition => Boolean(provider))
      .map(({ id, name, url_home }) => ({ id, name, url_home }));

  const broadcastOpenedProviders = () => {
    mainWindow.webContents.send('providers:opened', getOpenedProviders());
  };

  const getViewManager = () => viewManager;
  const getOrchestratorState = () => orchestratorState;
  const setOrchestratorState = (state: OrchestratorState) => { orchestratorState = state; };

  registerProvidersIpc(
    () => providersCache,
    getViewManager,
    getOrchestratorState,
    setOrchestratorState,
    saveState,
    broadcastOpenedProviders
  );

  registerNavigationIpc(getViewManager);
  registerSettingsIpc(getViewManager);
  registerViewIpc(getViewManager);

  loadRenderer(mainWindow);
  setupAutoUpdater(mainWindow);

  mainWindow.webContents.on('did-finish-load', () => {
    broadcastOpenedProviders();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const nextWindow = createMainWindow();
      if (configErrors) {
        const html = renderConfigErrorHtml(
          configErrors,
          getProvidersConfigPath()
        );
        nextWindow.loadURL(
          `data:text/html;charset=UTF-8,${encodeURIComponent(html)}`
        ).catch((error) => {
          logger.main.error('Failed to load config error page:', error);
        });
      } else {
        viewManager = new BrowserViewManager(nextWindow, FALLBACK_USER_AGENT);
        loadRenderer(nextWindow);
      }
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});