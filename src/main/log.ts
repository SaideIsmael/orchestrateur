import { app } from 'electron';
import log from 'electron-log/main';
import path from 'node:path';

log.initialize({ preload: true });

log.transports.file.level = 'info';
log.transports.file.maxSize = 5 * 1024 * 1024;
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {scope} {text}';
log.transports.file.resolvePathFn = () => path.join(app.getPath('userData'), 'logs', 'main.log');

log.transports.console.level = process.env.NODE_ENV === 'development' ? 'debug' : 'warn';

const createScopeLogger = (scope: string) => ({
  debug: (...args: unknown[]) => log.debug({ scope }, ...args),
  info: (...args: unknown[]) => log.info({ scope }, ...args),
  warn: (...args: unknown[]) => log.warn({ scope }, ...args),
  error: (...args: unknown[]) => log.error({ scope }, ...args),
});

export const logger = {
  main: createScopeLogger('MAIN'),
  ipc: createScopeLogger('IPC'),
  browserView: createScopeLogger('BROWSER_VIEW'),
  config: createScopeLogger('CONFIG'),
  state: createScopeLogger('STATE'),
  security: createScopeLogger('SECURITY'),
};

export { log };