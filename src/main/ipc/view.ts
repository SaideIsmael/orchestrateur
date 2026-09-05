import { safeIpcOn } from './utils';
import type { BrowserViewManager } from '../browserViewManager';
import type { BrowserBounds } from '../browserViewManager';

export function registerViewIpc(
  getViewManager: () => BrowserViewManager | null
) {
  safeIpcOn('view:setBounds', (_event, bounds: BrowserBounds) => {
    getViewManager()?.setBounds(bounds);
  });
}