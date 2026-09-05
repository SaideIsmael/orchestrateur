import { safeIpcHandle } from './utils';

export function registerAppIpc() {
  safeIpcHandle('app:ping', () => 'pong');
}