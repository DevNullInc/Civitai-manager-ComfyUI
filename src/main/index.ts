import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'path';
import { dbManager } from '../db/db';
import { civitaiClient } from '../services/civitaiClient';
import { folderRouter } from '../services/folderRouter';
import { downloadManager } from '../services/downloadManager';
import { libraryScanner } from '../services/libraryScanner';
import { versionManager } from '../services/versionManager';
import { backupService } from '../services/backupService';
import { encryptKey, decryptKey } from '../utils/secureStorage';
import { logger } from '../utils/logger';
import { AppConfig } from '../types/app';

let mainWindow: BrowserWindow | null = null;
let currentConfig: AppConfig = {
  comfyui_root: '',
  civitai_api_key: '',
  folder_mappings: {},
  advanced_mappings: { filename_patterns: [] },
  organize_by: { base_model: false, creator: false },
  conflict_strategy: 'rename',
  nsfw_max_visible_level: 5,
  nsfw_blur_enabled: true,
};

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 1024,
    minHeight: 700,
    title: 'CivitAI Model Manager - ComfyUI Edition',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    await mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

async function loadConfigFromDb() {
  try {
    const rows = await dbManager.all('SELECT key, value FROM app_config;');
    const cfgObj: any = {};
    rows.forEach((r: any) => {
      try {
        cfgObj[r.key] = JSON.parse(r.value);
      } catch (e) {
        cfgObj[r.key] = r.value;
      }
    });

    if (cfgObj.comfyui_root) currentConfig.comfyui_root = cfgObj.comfyui_root;
    if (cfgObj.civitai_api_key) {
      const decrypted = decryptKey(cfgObj.civitai_api_key);
      currentConfig.civitai_api_key = decrypted;
      civitaiClient.setApiKey(decrypted);
    }
    if (cfgObj.folder_mappings) currentConfig.folder_mappings = cfgObj.folder_mappings;
    if (cfgObj.advanced_mappings) currentConfig.advanced_mappings = cfgObj.advanced_mappings;
    if (cfgObj.organize_by) currentConfig.organize_by = cfgObj.organize_by;
    if (cfgObj.conflict_strategy) {
      currentConfig.conflict_strategy = cfgObj.conflict_strategy;
      downloadManager.setConflictStrategy(cfgObj.conflict_strategy);
    }

    folderRouter.updateConfig({
      rootPath: currentConfig.comfyui_root,
      folderMappings: currentConfig.folder_mappings,
      separateByBaseModel: currentConfig.organize_by.base_model,
      separateByCreator: currentConfig.organize_by.creator,
      advancedMappings: currentConfig.advanced_mappings,
    });
  } catch (err) {
    logger.error('Error loading config from SQLite:', err);
  }
}

function registerIpcHandlers() {
  ipcMain.handle('get-config', () => currentConfig);

  ipcMain.handle('save-config', async (_event, newConfig: Partial<AppConfig>) => {
    currentConfig = { ...currentConfig, ...newConfig };

    if (newConfig.civitai_api_key !== undefined) {
      const encrypted = encryptKey(newConfig.civitai_api_key);
      await dbManager.run(
        'INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?);',
        ['civitai_api_key', JSON.stringify(encrypted)]
      );
      civitaiClient.setApiKey(newConfig.civitai_api_key);
    }

    if (newConfig.comfyui_root !== undefined) {
      await dbManager.run(
        'INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?);',
        ['comfyui_root', JSON.stringify(newConfig.comfyui_root)]
      );
    }

    if (newConfig.folder_mappings) {
      await dbManager.run(
        'INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?);',
        ['folder_mappings', JSON.stringify(newConfig.folder_mappings)]
      );
    }

    if (newConfig.advanced_mappings) {
      await dbManager.run(
        'INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?);',
        ['advanced_mappings', JSON.stringify(newConfig.advanced_mappings)]
      );
    }

    if (newConfig.conflict_strategy) {
      downloadManager.setConflictStrategy(newConfig.conflict_strategy);
    }

    folderRouter.updateConfig({
      rootPath: currentConfig.comfyui_root,
      folderMappings: currentConfig.folder_mappings,
      separateByBaseModel: currentConfig.organize_by.base_model,
      separateByCreator: currentConfig.organize_by.creator,
      advancedMappings: currentConfig.advanced_mappings,
    });

    return currentConfig;
  });

  // CivitAI API Handlers
  ipcMain.handle('search-models', async (_event: unknown, params: any) => {
    return await civitaiClient.fetchModels(params);
  });

  ipcMain.handle('get-model', async (_event: unknown, id: number) => {
    return await civitaiClient.fetchModel(id);
  });

  ipcMain.handle('get-model-version', async (_event: unknown, id: number) => {
    return await civitaiClient.fetchModelVersion(id);
  });

  ipcMain.handle('get-enums', async () => {
    return await civitaiClient.fetchEnums();
  });

  // Scanner Handlers
  ipcMain.handle('scan-library', async (_event: unknown, rootPath: string) => {
    return await libraryScanner.scanDirectory(rootPath, (progress: any) => {
      if (mainWindow) {
        mainWindow.webContents.send('scan-progress', progress);
      }
    });
  });

  ipcMain.handle('get-local-models', async () => {
    return await dbManager.all('SELECT * FROM local_models ORDER BY file_name ASC;');
  });

  // Download Handlers
  ipcMain.handle('add-download', async (_event: unknown, taskParams: any) => {
    const computed = folderRouter.computePath({
      fileName: taskParams.fileName,
      modelType: taskParams.modelType,
      baseModel: taskParams.baseModel,
      creator: taskParams.creator,
    });

    const task = downloadManager.addTask({
      ...taskParams,
      targetFolder: computed.folderName,
      computedPath: computed.fullPath,
    });

    return task;
  });

  ipcMain.handle('pause-download', (_event: unknown, id: string) => {
    downloadManager.pauseTask(id);
    return true;
  });

  ipcMain.handle('resume-download', (_event: unknown, id: string) => {
    downloadManager.resumeTask(id);
    return true;
  });

  ipcMain.handle('cancel-download', (_event: unknown, id: string) => {
    downloadManager.cancelTask(id);
    return true;
  });

  ipcMain.handle('get-downloads', () => {
    return downloadManager.getTasks();
  });

  // Versioning & Backup
  ipcMain.handle('check-update', async (_event: unknown, localModel: any) => {
    return await versionManager.checkForUpdates(localModel);
  });

  ipcMain.handle('export-backup', async (_event: unknown, filePath: string) => {
    await backupService.exportBackup(filePath);
    return true;
  });

  ipcMain.handle('import-backup', async (_event: unknown, filePath: string) => {
    await backupService.importBackup(filePath);
    return true;
  });
}

// Timer to send download progress updates to renderer UI
setInterval(() => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const tasks = downloadManager.getTasks();
    if (tasks.length > 0) {
      mainWindow.webContents.send('download-progress', tasks);
    }
  }
}, 500);

app.whenReady().then(async () => {
  await dbManager.init();
  await loadConfigFromDb();
  registerIpcHandlers();
  await createWindow();

  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify().catch((err) => {
      logger.warn('Auto-updater check failed:', err);
    });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  dbManager.close().catch(() => {});
  if (process.platform !== 'darwin') app.quit();
});
