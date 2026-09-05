import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { logger } from '../log';

export function safeIpcHandle<TArgs extends unknown[], TReturn>(
  channel: string,
  handler: (_event: IpcMainInvokeEvent, ...args: TArgs) => TReturn
): void {
  ipcMain.handle(channel, async (_event, ...args: TArgs) => {
    try {
      return await handler(_event, ...args);
    } catch (error) {
      logger.ipc.error(`Error in ${channel}:`, error);
      return { ok: false, error: error instanceof Error ? error.message : 'Erreur inconnue' };
    }
  });
}

export function safeIpcOn<TArgs extends unknown[]>(
  channel: string,
  handler: (_event: Electron.IpcMainEvent, ...args: TArgs) => void
): void {
  ipcMain.on(channel, (_event, ...args: TArgs) => {
    try {
      handler(_event, ...args);
    } catch (error) {
      logger.ipc.error(`Error in ${channel}:`, error);
    }
  });
}