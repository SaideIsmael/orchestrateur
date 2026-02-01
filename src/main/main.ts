import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { getProvidersConfigPath, loadProvidersConfig } from './providersStore';
import { loadState } from './stateStore';

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);

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
      enableRemoteModule: false
    } as Electron.WebPreferences
  });

  return mainWindow;
}

function loadRenderer(mainWindow: BrowserWindow) {
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
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
  ipcMain.handle('app:ping', () => 'pong');
  const mainWindow = createMainWindow();
  const providersResult = loadProvidersConfig();
  loadState();

  if (!providersResult.ok) {
    const html = renderConfigErrorHtml(
      providersResult.errors,
      getProvidersConfigPath()
    );
    mainWindow.loadURL(
      `data:text/html;charset=UTF-8,${encodeURIComponent(html)}`
    );
  } else {
    loadRenderer(mainWindow);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const nextWindow = createMainWindow();
      loadRenderer(nextWindow);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
