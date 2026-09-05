import { app } from 'electron';
import { safeIpcHandle } from './utils';
import type { BrowserViewManager } from '../browserViewManager';
import { loadProvidersConfig } from '../providersStore';
import { checkStateHealth } from '../stateStore';
import type { AppHealth } from '../../shared/types';

export function registerAppIpc(getViewManager: () => BrowserViewManager | null) {
  safeIpcHandle('app:ping', () => 'pong');

  safeIpcHandle('app:health', (): AppHealth => {
    const providersResult = loadProvidersConfig();
    const stateHealth = checkStateHealth();
    const activeProvider = getViewManager()?.getNavState().providerId ?? null;

    const providers = providersResult.ok
      ? { ok: true, count: providersResult.providers.length, errors: [] as string[] }
      : { ok: false, count: 0, errors: providersResult.errors };

    return {
      ok: providers.ok && stateHealth.ok,
      version: app.getVersion(),
      packaged: app.isPackaged,
      uptimeSeconds: Math.round(process.uptime()),
      providers,
      state: stateHealth,
      activeProvider,
      timestamp: new Date().toISOString()
    };
  });
}