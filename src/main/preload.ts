import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('orchestrator', {
  ping: () => ipcRenderer.invoke('app:ping'),
  getProviders: () => ipcRenderer.invoke('providers:list'),
  openProvider: (providerId: string) =>
    ipcRenderer.invoke('provider:open', providerId),
  setBrowserBounds: (bounds: { x: number; y: number; width: number; height: number }) =>
    ipcRenderer.send('view:setBounds', bounds),
  navigateBack: () => ipcRenderer.invoke('nav:back'),
  navigateForward: () => ipcRenderer.invoke('nav:forward'),
  reload: () => ipcRenderer.invoke('nav:reload'),
  getNavState: () => ipcRenderer.invoke('nav:state'),
  onNavState: (callback: (state: { canGoBack: boolean; canGoForward: boolean; url: string; title: string; providerId: string | null }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: { canGoBack: boolean; canGoForward: boolean; url: string; title: string; providerId: string | null }) => {
      callback(state);
    };
    ipcRenderer.on('nav:state', listener);
    return () => ipcRenderer.removeListener('nav:state', listener);
  }
});
