import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => {
  const app = {
    isPackaged: false,
    whenReady: vi.fn(() => Promise.resolve()),
    on: vi.fn(),
    getPath: vi.fn(() => process.cwd()),
    getAppPath: vi.fn(() => process.cwd())
  };

  const ipcMain = {
    handle: vi.fn(),
    on: vi.fn()
  };

  class BrowserWindow {
    static getAllWindows() {
      return [];
    }

    webContents = {
      send: vi.fn(),
      on: vi.fn(),
      openDevTools: vi.fn(),
      loadURL: vi.fn(),
      loadFile: vi.fn()
    };

    contentView = {
      addChildView: vi.fn(),
      removeChildView: vi.fn()
    };

    constructor() {}

    loadURL() {}
    loadFile() {}
  }

  class WebContentsView {
    webContents = {
      setUserAgent: vi.fn(),
      setWindowOpenHandler: vi.fn(),
      loadURL: vi.fn(),
      canGoBack: vi.fn(() => false),
      canGoForward: vi.fn(() => false),
      getURL: vi.fn(() => ''),
      getTitle: vi.fn(() => ''),
      on: vi.fn(),
      reload: vi.fn(),
      goBack: vi.fn(),
      goForward: vi.fn()
    };

    constructor() {}

    setBounds() {}
  }

  const session = {
    fromPartition: vi.fn(() => ({
      webRequest: {
        onBeforeSendHeaders: vi.fn()
      }
    }))
  };

  return {
    app,
    ipcMain,
    BrowserWindow,
    WebContentsView,
    session
  };
});

describe('main process smoke', () => {
  it('boots without crashing', async () => {
    await import('../src/main/main');
    expect(true).toBe(true);
  }, 30000);
});
