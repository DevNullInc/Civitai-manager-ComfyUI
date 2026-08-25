import { contextBridge, ipcRenderer } from 'electron';

const api = {
  // Settings & Config
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config: any) => ipcRenderer.invoke('save-config', config),
  setApiKey: (key: string) => ipcRenderer.invoke('set-api-key', key),

  // CivitAI API
  searchModels: (params: any) => ipcRenderer.invoke('search-models', params),
  getModel: (id: number) => ipcRenderer.invoke('get-model', id),
  getModelVersion: (id: number) => ipcRenderer.invoke('get-model-version', id),
  getEnums: () => ipcRenderer.invoke('get-enums'),

  // Scanner & Library
  scanLibrary: (rootPath: string) => ipcRenderer.invoke('scan-library', rootPath),
  getLocalModels: () => ipcRenderer.invoke('get-local-models'),
  onScanProgress: (callback: (progress: any) => void) => {
    ipcRenderer.on('scan-progress', (_event: unknown, progress: any) => callback(progress));
  },

  // Download Queue
  addDownload: (task: any) => ipcRenderer.invoke('add-download', task),
  pauseDownload: (id: string) => ipcRenderer.invoke('pause-download', id),
  resumeDownload: (id: string) => ipcRenderer.invoke('resume-download', id),
  cancelDownload: (id: string) => ipcRenderer.invoke('cancel-download', id),
  getDownloads: () => ipcRenderer.invoke('get-downloads'),
  onDownloadProgress: (callback: (tasks: any[]) => void) => {
    ipcRenderer.on('download-progress', (_event: unknown, tasks: any) => callback(tasks));
  },

  // Versioning & Backup
  checkUpdate: (localModel: any) => ipcRenderer.invoke('check-update', localModel),
  exportBackup: (filePath: string) => ipcRenderer.invoke('export-backup', filePath),
  importBackup: (filePath: string) => ipcRenderer.invoke('import-backup', filePath),
  // Delete local model
  deleteLocalModel: (id: string) => ipcRenderer.invoke('delete-local-model', id),
   // App control
   restartApp: () => ipcRenderer.invoke('restart-app'),
   shutdownApp: () => ipcRenderer.invoke('shutdown-app'),
};

contextBridge.exposeInMainWorld('civitaiAPI', api);

declare global {
  interface Window {
    civitaiAPI: typeof api & { _isMock?: boolean };
  }
}
