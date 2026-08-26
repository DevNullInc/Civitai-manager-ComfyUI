const API_BASE = '/api';

const scanProgressListeners: Array<(progress: any) => void> = [];
const downloadProgressListeners: Array<(tasks: any[]) => void> = [];

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
        const res = await fetch(`${API_BASE}/scan-library`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rootPath }),
        });
        return await res.json();
      },

      getLocalModels: async () => {
        const res = await fetch(`${API_BASE}/local-models`);
        return await res.json();
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
