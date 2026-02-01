import { BrowserView, BrowserWindow, session } from 'electron';
import type { ProviderDefinition } from '../shared/providers';

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
  private view: BrowserView | null = null;
  private bounds: BrowserBounds = { x: 0, y: 0, width: 800, height: 600 };
  private activeProviderId: string | null = null;
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
      this.window.removeBrowserView(this.view);
      this.view = null;
    }

    this.view = new BrowserView({
      webPreferences: {
        session: providerSession,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        enableRemoteModule: false
      } as Electron.WebPreferences
    });

    this.window.setBrowserView(this.view);
    this.view.setBounds(this.bounds);
    this.view.setAutoResize({ width: false, height: false });

    const userAgent = provider.userAgentOverride || this.fallbackUserAgent;
    this.view.webContents.setUserAgent(userAgent);

    this.activeProviderId = provider.id;
    this.attachNavigationEvents();
    this.view.webContents.loadURL(provider.url_home);

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
  }

  private emitNavState() {
    const state = this.getNavState();
    this.window.webContents.send('nav:state', state);
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

    this.configuredSessions.add(partitionId);
  }
}
