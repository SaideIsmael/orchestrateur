import { safeIpcHandle } from './utils';
import type { BrowserViewManager } from '../browserViewManager';

export function registerNavigationIpc(
  getViewManager: () => BrowserViewManager | null
) {
  safeIpcHandle('nav:back', () => getViewManager()?.navigateBack());
  safeIpcHandle('nav:forward', () => getViewManager()?.navigateForward());
  safeIpcHandle('nav:reload', () => getViewManager()?.reload());
  safeIpcHandle('nav:state', () => getViewManager()?.getNavState());
}