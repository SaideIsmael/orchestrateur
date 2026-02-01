import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('orchestrator', {
  ping: () => ipcRenderer.invoke('app:ping')
});