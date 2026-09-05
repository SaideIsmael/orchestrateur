import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('orchestrator', {
  ping: () => ipcRenderer.invoke('app:ping'),
  getHealth: () => ipcRenderer.invoke('app:health'),
  getProviders: () => ipcRenderer.invoke('providers:list'),
  getOpenedProviders: () => ipcRenderer.invoke('providers:opened'),
  openProvider: (providerId: string) =>
    ipcRenderer.invoke('provider:open', providerId),
  setBrowserBounds: (bounds: { x: number; y: number; width: number; height: number }) =>
    ipcRenderer.send('view:setBounds', bounds),
  navigateBack: () => ipcRenderer.invoke('nav:back'),
  navigateForward: () => ipcRenderer.invoke('nav:forward'),
  reload: () => ipcRenderer.invoke('nav:reload'),
  getNavState: () => ipcRenderer.invoke('nav:state'),
  getPermissiveMode: () => ipcRenderer.invoke('settings:getPermissive'),
  setPermissiveMode: (enabled: boolean) =>
    ipcRenderer.invoke('settings:setPermissive', enabled),
  onNavState: (callback: (state: { canGoBack: boolean; canGoForward: boolean; url: string; title: string; providerId: string | null }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: { canGoBack: boolean; canGoForward: boolean; url: string; title: string; providerId: string | null }) => {
      callback(state);
    };
    ipcRenderer.on('nav:state', listener);
    return () => ipcRenderer.removeListener('nav:state', listener);
  },
  onNotification: (callback: (payload: { level: 'warning' | 'info'; message: string }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: { level: 'warning' | 'info'; message: string }) => {
      callback(payload);
    };
    ipcRenderer.on('ui:notification', listener);
    return () => ipcRenderer.removeListener('ui:notification', listener);
  },
  onOpenedProviders: (
    callback: (providers: { id: string; name: string; url_home: string }[]) => void
  ) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      providers: { id: string; name: string; url_home: string }[]
    ) => {
      callback(providers);
    };
    ipcRenderer.on('providers:opened', listener);
    return () => ipcRenderer.removeListener('providers:opened', listener);
  }
});
