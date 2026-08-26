/**
 * CivitAI Model Manager - ComfyUI Edition
 * Copyright (C) 2025-2026 TheStygianRenegade / /dev/null Inc
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
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
  cancelScan: () => ipcRenderer.invoke('cancel-scan'),
  getScanStatus: () => ipcRenderer.invoke('get-scan-status'),
  getLocalModels: () => ipcRenderer.invoke('get-local-models'),
  clearLibrary: () => ipcRenderer.invoke('clear-library'),
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
  openFolder: (filePath: string) => ipcRenderer.invoke('open-folder', filePath),
  // External Link & System Info
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
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
