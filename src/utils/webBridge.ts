/**
 * CivitAI Model Manager - ComfyUI Edition
 * Copyright (C) 2025-2026 TheStygianRenegade / /dev/null Inc
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
const API_BASE = '/api';

const scanProgressListeners: Array<(progress: any) => void> = [];
const downloadProgressListeners: Array<(tasks: any[]) => void> = [];

// Real-time scan and download status polling in web browser mode
if (typeof window !== 'undefined') {
  setInterval(async () => {
    if (scanProgressListeners.length > 0) {
      try {
        const res = await fetch(`${API_BASE}/get-scan-status`);
        if (res.ok) {
          const progress = await res.json();
          if (progress) {
            scanProgressListeners.forEach((cb) => cb(progress));
          }
        }
      } catch (e) {}
    }
  }, 400);

  setInterval(async () => {
    if (downloadProgressListeners.length > 0) {
      try {
        const res = await fetch(`${API_BASE}/downloads`);
        if (res.ok) {
          const tasks = await res.json();
          downloadProgressListeners.forEach((cb) => cb(tasks));
        }
      } catch (e) {}
    }
  }, 750);
}

export function setupWebBridgeIfNeeded() {
  if (typeof window !== 'undefined' && !window.civitaiAPI) {
    console.info('[CivitAI Manager] Electron IPC not found. Initializing HTTP Native Server Bridge on port 5174.');

    window.civitaiAPI = {
      getConfig: async () => {
        try {
          const res = await fetch(`${API_BASE}/config`);
          return await res.json();
        } catch (e) {
          console.warn('HTTP Bridge not connected:', e);
          return null;
        }
      },

      saveConfig: async (config: any) => {
        const res = await fetch(`${API_BASE}/save-config`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config),
        });
        return await res.json();
      },

      setApiKey: async (key: string) => {
        await fetch(`${API_BASE}/save-config`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ civitai_api_key: key }),
        });
      },

      searchModels: async (params: any) => {
        const res = await fetch(`${API_BASE}/search-models`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        });
        return await res.json();
      },

      getModel: async (id: number) => {
        const res = await fetch(`${API_BASE}/model/${id}`);
        return await res.json();
      },

      getModelVersion: async (id: number) => {
        const res = await fetch(`${API_BASE}/model-version/${id}`);
        return await res.json();
      },

      getEnums: async () => {
        const res = await fetch(`${API_BASE}/enums`);
        return await res.json();
      },

      scanLibrary: async (rootPath: string | string[]) => {
        try {
          const res = await fetch(`${API_BASE}/scan-library`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rootPath }),
          });
          if (!res.ok) {
            const errTxt = await res.text();
            throw new Error(errTxt || `Server error: ${res.status}`);
          }
          return await res.json();
        } catch (e: any) {
          console.error('scanLibrary failed:', e);
          throw e;
        }
      },

      cancelScan: async () => {
        try {
          const res = await fetch(`${API_BASE}/cancel-scan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
          return await res.json();
        } catch (e) {
          return { success: false };
        }
      },

      getScanStatus: async () => {
        try {
          const res = await fetch(`${API_BASE}/get-scan-status`);
          if (!res.ok) return null;
          return await res.json();
        } catch (e) {
          return null;
        }
      },

      getLocalModels: async () => {
        try {
          const res = await fetch(`${API_BASE}/local-models`);
          if (!res.ok) return [];
          return await res.json();
        } catch (e) {
          console.error('getLocalModels failed:', e);
          return [];
        }
      },

      clearLibrary: async () => {
        try {
          const res = await fetch(`${API_BASE}/clear-library`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
          if (!res.ok) {
            const errTxt = await res.text();
            throw new Error(errTxt || `Server error: ${res.status}`);
          }
          return await res.json();
        } catch (e: any) {
          console.error('clearLibrary failed:', e);
          throw e;
        }
      },

      onScanProgress: (callback: (progress: any) => void) => {
        scanProgressListeners.push(callback);
      },

      addDownload: async (task: any) => {
        const res = await fetch(`${API_BASE}/add-download`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(task),
        });
        return await res.json();
      },

      pauseDownload: async (id: string) => {
        const res = await fetch(`${API_BASE}/pause-download`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        });
        return await res.json();
      },

      resumeDownload: async (id: string) => {
        const res = await fetch(`${API_BASE}/resume-download`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        });
        return await res.json();
      },

      cancelDownload: async (id: string) => {
        const res = await fetch(`${API_BASE}/cancel-download`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        });
        return await res.json();
      },

      forceCompleteDownload: async (id: string) => {
        try {
          const res = await fetch(`${API_BASE}/force-complete-download`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
          });
          const data = await res.json();
          return data.success;
        } catch (e) {
          console.error('forceCompleteDownload failed:', e);
          return false;
        }
      },

      getDownloads: async () => {
        const res = await fetch(`${API_BASE}/downloads`);
        return await res.json();
      },

      onDownloadProgress: (callback: (tasks: any[]) => void) => {
        downloadProgressListeners.push(callback);
      },

      checkUpdate: async (localModel: any) => {
        const res = await fetch(`${API_BASE}/check-update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(localModel),
        });
        return await res.json();
      },

      checkAllUpdates: async () => {
        try {
          const res = await fetch(`${API_BASE}/check-all-updates`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
          return await res.json();
        } catch (e) {
          console.error('checkAllUpdates failed:', e);
          return { totalChecked: 0, updatesFound: 0, modelsWithUpdates: [] };
        }
      },

      onUpdateCheckProgress: (_callback: (progress: any) => void) => {},

      exportBackup: async (filePath: string) => {
        const res = await fetch(`${API_BASE}/export-backup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath }),
        });
        return await res.json();
      },

      importBackup: async (filePath: string) => {
        const res = await fetch(`${API_BASE}/import-backup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath }),
        });
        return await res.json();
      },

      deleteLocalModel: async (id: string) => {
        const res = await fetch(`${API_BASE}/delete-local-model`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        });
        return await res.json();
      },

      openFolder: async (filePath: string) => {
        const res = await fetch(`${API_BASE}/open-folder`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath }),
        });
        return await res.json();
      },

      openExternal: async (url: string) => {
        window.open(url, '_blank', 'noopener,noreferrer');
        return true;
      },

      getSystemInfo: async () => {
        return {
          version: '1.1.0',
          platform: navigator.platform || 'web',
          userAgent: navigator.userAgent,
        };
      },

      onAppLog: (_callback: (log: { level: string; message: string }) => void) => () => {},

      restartApp: async () => {
        try {
          await fetch(`${API_BASE}/restart-app`, { method: 'POST' });
        } catch (e) {
          // Connection will drop on restart — expected
        }
        return true;
      },

      shutdownApp: async () => {
        try {
          await fetch(`${API_BASE}/shutdown-app`, { method: 'POST' });
        } catch (e) {
          // Connection will drop on shutdown — expected
        }
        return true;
      },
    };
  }
}
