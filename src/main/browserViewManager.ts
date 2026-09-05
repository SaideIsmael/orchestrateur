import { WebContentsView, BrowserWindow, session } from 'electron';
import type { ProviderDefinition } from '../shared/providers';
import { allowNavigation } from '../shared/allowlist';
import { logger } from './log';
import { mergeCsp } from './csp';

export type BrowserBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type NavState = {
  canGoBack: boolean;
  canGoForward: boolean;
  url: string;
  title: string;
  providerId: string | null;
};

const ACCEPT_LANGUAGE = 'fr-FR,fr;q=0.9';

export class BrowserViewManager {
  private window: BrowserWindow;
  private view: WebContentsView | null = null;
  private bounds: BrowserBounds = { x: 0, y: 0, width: 800, height: 600 };
  private activeProviderId: string | null = null;
  private allowlist: string[] = [];
  private permissiveMode = false;
  private configuredSessions = new Set<string>();
  private readonly fallbackUserAgent: string;

  constructor(window: BrowserWindow, fallbackUserAgent: string) {
    this.window = window;
    this.fallbackUserAgent = fallbackUserAgent;
  }

  setBounds(bounds: BrowserBounds) {
    const nextBounds = {
      x: Math.max(0, Math.round(bounds.x)),
      y: Math.max(0, Math.round(bounds.y)),
      width: Math.max(0, Math.round(bounds.width)),
      height: Math.max(0, Math.round(bounds.height))
    };

    this.bounds = nextBounds;
    if (this.view) {
      this.view.setBounds(this.bounds);
    }
  }

  openProvider(provider: ProviderDefinition) {
    const partitionId = `persist:orchestrateur:${provider.id}`;
    const providerSession = session.fromPartition(partitionId);

    this.applySessionHeaders(partitionId, providerSession);

    if (this.view) {
      this.window.contentView.removeChildView(this.view);
      this.view = null;
    }

    this.view = new WebContentsView({
      webPreferences: {
        session: providerSession,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webviewTag: false,
        safeDialogs: true
      } as Electron.WebPreferences
    });

    this.window.contentView.addChildView(this.view);
    this.view.setBounds(this.bounds);

    const userAgent = provider.userAgentOverride || this.fallbackUserAgent;
    this.view.webContents.setUserAgent(userAgent);
    this.view.webContents.setWindowOpenHandler(({ url }) => {
      if (!this.isUrlAllowed(url)) {
        this.notify('Navigation bloquee (hors liste blanche).');
        return { action: 'deny' };
      }

      this.view?.webContents.loadURL(url).catch((error) => {
        logger.browserView.error('loadURL failed in setWindowOpenHandler:', error);
        this.notify(`Erreur de navigation : ${error.message}`);
      });
      return { action: 'deny' };
    });

    this.activeProviderId = provider.id;
    this.allowlist = [...provider.allowlist];
    this.attachNavigationEvents();
    this.view.webContents.loadURL(provider.url_home).catch((error) => {
      logger.browserView.error('loadURL failed for provider:', error);
      this.notify(`Impossible de charger le fournisseur : ${error.message}`);
    });

    this.emitNavState();
  }

  navigateBack() {
    if (this.view?.webContents.canGoBack()) {
      this.view.webContents.goBack();
    }
  }

  navigateForward() {
    if (this.view?.webContents.canGoForward()) {
      this.view.webContents.goForward();
    }
  }

  reload() {
    this.view?.webContents.reload();
  }

  getNavState(): NavState {
    const contents = this.view?.webContents;
    return {
      canGoBack: contents?.canGoBack() ?? false,
      canGoForward: contents?.canGoForward() ?? false,
      url: contents?.getURL() ?? '',
      title: contents?.getTitle() ?? '',
      providerId: this.activeProviderId
    };
  }

  setPermissiveMode(enabled: boolean) {
    this.permissiveMode = enabled;
  }

  getPermissiveMode() {
    return this.permissiveMode;
  }

  private attachNavigationEvents() {
    if (!this.view) {
      return;
    }

    const contents = this.view.webContents;
    const update = () => this.emitNavState();

    contents.on('did-navigate', update);
    contents.on('did-navigate-in-page', update);
    contents.on('did-start-navigation', update);
    contents.on('page-title-updated', update);
    contents.on('did-stop-loading', update);

    contents.on('will-navigate', (event, url) => {
      if (!this.isUrlAllowed(url)) {
        event.preventDefault();
        this.notify('Navigation bloquee (hors liste blanche).');
      }
    });

    contents.on('will-redirect', (event, url, _isInPlace, isMainFrame) => {
      if (isMainFrame && !this.isUrlAllowed(url)) {
        event.preventDefault();
        this.notify('Navigation bloquee (hors liste blanche).');
      }
    });
  }

  private emitNavState() {
    const state = this.getNavState();
    this.window.webContents.send('nav:state', state);
  }

  private isUrlAllowed(url: string) {
    if (this.permissiveMode) {
      if (!allowNavigation(url, this.allowlist)) {
        this.notify('Navigation hors liste blanche (mode permissif).');
      }
      return true;
    }

    return allowNavigation(url, this.allowlist);
  }

  private notify(message: string) {
    this.window.webContents.send('ui:notification', {
      level: 'warning',
      message
    });
  }

  private applySessionHeaders(partitionId: string, providerSession: Electron.Session) {
    if (this.configuredSessions.has(partitionId)) {
      return;
    }

    providerSession.webRequest.onBeforeSendHeaders((details, callback) => {
      const headers = {
        ...details.requestHeaders,
        'Accept-Language': ACCEPT_LANGUAGE
      };
      callback({ requestHeaders: headers });
    });

    const csp = [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ');

    providerSession.webRequest.onHeadersReceived((details, callback) => {
      const headers = { ...(details.responseHeaders || {}) };

      const existingKey = Object.keys(headers).find(
        (key) => key.toLowerCase() === 'content-security-policy'
      );
      const existingValue = existingKey ? headers[existingKey][0] : undefined;
      if (existingKey) {
        delete headers[existingKey];
      }

      headers['Content-Security-Policy'] = [mergeCsp(existingValue, csp)];
      callback({ responseHeaders: headers });
    });

    this.configuredSessions.add(partitionId);
  }
}
