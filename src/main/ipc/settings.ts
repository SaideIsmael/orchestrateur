import { safeIpcHandle } from './utils';
import type { BrowserViewManager } from '../browserViewManager';

export function registerSettingsIpc(
  getViewManager: () => BrowserViewManager | null
) {
  safeIpcHandle('settings:getPermissive', () => getViewManager()?.getPermissiveMode());
  safeIpcHandle('settings:setPermissive', (_event, enabled: boolean) => {
    getViewManager()?.setPermissiveMode(Boolean(enabled));
    return getViewManager()?.getPermissiveMode();
  });
}