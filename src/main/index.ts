/**
 * CivitAI Model Manager - ComfyUI Edition
 * Copyright (C) 2025-2026 TheStygianRenegade / /dev/null Inc
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import { app, BrowserWindow, ipcMain, dialog, Menu, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'path';
import fs from 'fs';
import http from 'http';
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

app.setName('civitai-model-manager');

let mainWindow: BrowserWindow | null = null;
let currentConfig: AppConfig = {
  comfyui_root: '',
  comfyui_folders: [],
  civitai_api_key: '',
  folder_mappings: {},
  advanced_mappings: { filename_patterns: [] },
  organize_by: { base_model: false, creator: false },
  conflict_strategy: 'rename',
  nsfw_max_visible_level: 5,
  nsfw_blur_enabled: true,
};

async function createWindow() {
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1380,
    height: 880,
    minWidth: 1124,
    minHeight: 720,
    title: 'CivitAI Model Manager - ComfyUI Edition',
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.removeMenu();
  mainWindow.setMenuBarVisibility(false);

  const indexPath = path.join(__dirname, '../index.html');
  const devServerUrl = process.env.VITE_DEV_SERVER_URL || (process.env.PORT ? `http://localhost:${process.env.PORT}` : 'http://localhost:5173');
  const fs = require('fs');

  let loaded = false;
  // Try loading from Vite server if running
  try {
    await mainWindow.loadURL(devServerUrl);
    loaded = true;
  } catch (e) {
    logger.info(`Vite server not responding at ${devServerUrl}, falling back to static files.`);
  }

  // Load the compiled static app
  if (!loaded) {
    if (fs.existsSync(indexPath)) {
      await mainWindow.loadFile(indexPath);
    } else {
      await mainWindow.loadURL(devServerUrl);
    }
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
    if (cfgObj.comfyui_folders) currentConfig.comfyui_folders = cfgObj.comfyui_folders;
    if ((!currentConfig.comfyui_folders || currentConfig.comfyui_folders.length === 0) && currentConfig.comfyui_root) {
      currentConfig.comfyui_folders = [currentConfig.comfyui_root];
    }
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
    if (cfgObj.strict_hash_verification !== undefined) {
      currentConfig.strict_hash_verification = cfgObj.strict_hash_verification;
      downloadManager.setStrictHashVerification(cfgObj.strict_hash_verification);
    }
    if (cfgObj.max_concurrent_downloads !== undefined) {
      currentConfig.max_concurrent_downloads = cfgObj.max_concurrent_downloads;
      downloadManager.setMaxConcurrent(cfgObj.max_concurrent_downloads);
    }

    folderRouter.updateConfig({
      rootPath: currentConfig.comfyui_root || currentConfig.comfyui_folders[0] || '',
      folderPaths: currentConfig.comfyui_folders,
      folderMappings: currentConfig.folder_mappings,
      separateByBaseModel: currentConfig.organize_by.base_model,
      separateByCreator: currentConfig.organize_by.creator,
      advancedMappings: currentConfig.advanced_mappings,
    });
  } catch (err) {
    logger.error('Error loading config from SQLite:', err);
  }
}

function startHttpBridgeServer() {
  const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = req.url || '';

    const getBody = (): Promise<any> =>
      new Promise((resolve) => {
        let data = '';
        req.on('data', (chunk) => (data += chunk));
        req.on('end', () => {
          try {
            resolve(data ? JSON.parse(data) : {});
          } catch {
            resolve({});
          }
        });
      });

    try {
      if (url === '/api/config' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(currentConfig));
      } else if (url === '/api/save-config' && req.method === 'POST') {
        const body = await getBody();
        currentConfig = { ...currentConfig, ...body };

        if (body.comfyui_root !== undefined) {
          await dbManager.run(
            'INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?);',
            ['comfyui_root', JSON.stringify(body.comfyui_root)]
          );
        }
        if (body.comfyui_folders !== undefined) {
          await dbManager.run(
            'INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?);',
            ['comfyui_folders', JSON.stringify(body.comfyui_folders)]
          );
        }
        if (body.civitai_api_key !== undefined) {
          const encrypted = encryptKey(body.civitai_api_key);
          await dbManager.run(
            'INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?);',
            ['civitai_api_key', JSON.stringify(encrypted)]
          );
          civitaiClient.setApiKey(body.civitai_api_key);
        }
        if (body.folder_mappings) {
          await dbManager.run(
            'INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?);',
            ['folder_mappings', JSON.stringify(body.folder_mappings)]
          );
        }
        if (body.advanced_mappings) {
          await dbManager.run(
            'INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?);',
            ['advanced_mappings', JSON.stringify(body.advanced_mappings)]
          );
        }

        if (body.strict_hash_verification !== undefined) {
          downloadManager.setStrictHashVerification(body.strict_hash_verification);
          await dbManager.run(
            'INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?);',
            ['strict_hash_verification', JSON.stringify(body.strict_hash_verification)]
          );
        }

        if (body.max_concurrent_downloads !== undefined) {
          downloadManager.setMaxConcurrent(body.max_concurrent_downloads);
          await dbManager.run(
            'INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?);',
            ['max_concurrent_downloads', JSON.stringify(body.max_concurrent_downloads)]
          );
        }

        folderRouter.updateConfig({
          rootPath: currentConfig.comfyui_root,
          folderPaths: currentConfig.comfyui_folders,
          folderMappings: currentConfig.folder_mappings,
          separateByBaseModel: currentConfig.organize_by.base_model,
          separateByCreator: currentConfig.organize_by.creator,
          advancedMappings: currentConfig.advanced_mappings,
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(currentConfig));
      } else if (url === '/api/scan-library' && req.method === 'POST') {
        const body = await getBody();
        // Fire-and-forget background scan to prevent HTTP socket headers timeout on large model directories
        libraryScanner
          .scanDirectory(body.rootPath, (progress) => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('scan-progress', progress);
            }
          })
          .catch((err) => {
            logger.error('Background folder scan error:', err);
          });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, status: 'scanning' }));
      } else if (url === '/api/check-all-updates' && req.method === 'POST') {
        const result = await versionManager.batchCheckAllUpdates();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } else if (url === '/api/force-complete-download' && req.method === 'POST') {
        const body = await getBody();
        const success = await downloadManager.forceCompleteTask(body.id);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success }));
      } else if (url === '/api/local-models' && req.method === 'GET') {
        const rows = await dbManager.all('SELECT * FROM local_models ORDER BY file_name ASC;');
        const models = rows.map((r: any) => ({
          id: r.id,
          filePath: r.file_path,
          fileName: r.file_name,
          fileSize: r.file_size,
          modifiedAt: r.modified_at,
          sha256: r.sha256,
          civitaiModelId: r.civitai_model_id,
          civitaiVersionId: r.civitai_version_id,
          previewUrl: r.preview_url,
          modelType: r.model_type,
          isMatched: !!r.civitai_version_id,
          isDuplicate: !!r.is_duplicate,
        }));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(models));
      } else if (url === '/api/search-models' && req.method === 'POST') {
        const body = await getBody();
        const result = await civitaiClient.fetchModels(body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } else if (url === '/api/enums' && req.method === 'GET') {
        const enums = await civitaiClient.fetchEnums();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(enums));
      } else if (url === '/api/add-download' && req.method === 'POST') {
        const body = await getBody();
        let downloadUrl = body.downloadUrl;
        if (body.modelVersionId) {
          downloadUrl = civitaiClient.getDownloadUrl(body.modelVersionId);
        } else if (currentConfig.civitai_api_key && downloadUrl && !downloadUrl.includes('token=')) {
          const sep = downloadUrl.includes('?') ? '&' : '?';
          downloadUrl = `${downloadUrl}${sep}token=${encodeURIComponent(currentConfig.civitai_api_key)}`;
        }
        const computed = folderRouter.computePath({
          fileName: body.fileName,
          modelType: body.modelType,
          baseModel: body.baseModel,
          creator: body.creator,
        });
        const task = downloadManager.addTask({
          ...body,
          downloadUrl,
          targetFolder: computed.folderName,
          computedPath: computed.fullPath,
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(task));
      } else if (url === '/api/downloads' && req.method === 'GET') {
        const tasks = downloadManager.getTasks();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(tasks));
      } else if (url === '/api/pause-download' && req.method === 'POST') {
        const body = await getBody();
        downloadManager.pauseTask(body.id);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } else if (url === '/api/resume-download' && req.method === 'POST') {
        const body = await getBody();
        downloadManager.resumeTask(body.id);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } else if (url === '/api/cancel-download' && req.method === 'POST') {
        const body = await getBody();
        downloadManager.cancelTask(body.id);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } else if (url === '/api/delete-local-model' && req.method === 'POST') {
        const body = await getBody();
        const model = await dbManager.get('SELECT * FROM local_models WHERE id = ?', [body.id]);
        if (!model) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Model not found' }));
        } else {
          try {
            if (fs.existsSync(model.file_path)) {
              fs.unlinkSync(model.file_path);
            }
            await dbManager.run('DELETE FROM local_models WHERE id = ?', [body.id]);
            await libraryScanner.flagDuplicates();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
          } catch (delErr: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: delErr.message }));
          }
        }
      } else if (url === '/api/open-folder' && req.method === 'POST') {
        const body = await getBody();
        if (body.filePath) {
          try {
            const { exec } = require('child_process');
            exec(`explorer.exe /select,"${body.filePath}"`);
          } catch (e) {}
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } else if (url === '/api/cancel-scan' && req.method === 'POST') {
        libraryScanner.cancelScan();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } else if (url === '/api/get-scan-status' && req.method === 'GET') {
        const status = libraryScanner.getScanStatus();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(status));
      } else if (url === '/api/clear-library' && req.method === 'POST') {
        await dbManager.run('DELETE FROM local_models;');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    } catch (err: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      logger.warn('Port 5174 is already in use by an active instance. Reusing existing bridge connection.');
    } else {
      logger.error('HTTP Server bridge error:', err);
    }
  });

  server.listen(5174, () => {
    logger.info('HTTP Native Server Bridge running on http://localhost:5174');
  });
}

function registerIpcHandlers() {
  ipcMain.handle('get-config', () => currentConfig);

  // Clear library cache from SQLite
  ipcMain.handle('clear-library', async () => {
    try {
      await dbManager.run('DELETE FROM local_models;');
      logger.info('Library cache cleared from database.');
      return { success: true };
    } catch (e: any) {
      logger.error('Failed to clear library database:', e);
      return { success: false, error: e?.message || 'Unknown error' };
    }
  });

  // Delete a local model from the database and filesystem
  ipcMain.handle('delete-local-model', async (_event: unknown, modelId: string) => {
    // Get model info first
    const model = await dbManager.get('SELECT * FROM local_models WHERE id = ?', [modelId]);
    if (!model) return { success: false, error: 'Model not found' };
    try {
      if (fs.existsSync(model.file_path)) {
        fs.unlinkSync(model.file_path);
      }
      await dbManager.run('DELETE FROM local_models WHERE id = ?', [modelId]);
      await libraryScanner.flagDuplicates();
      return { success: true };
    } catch (e: any) {
      logger.error('Failed to delete model', e);
      return { success: false, error: e?.message || 'Unknown error' };
    }
  });

  // Open folder / reveal file in explorer
  ipcMain.handle('open-folder', (_event: unknown, filePath: string) => {
    try {
      if (filePath) {
        shell.showItemInFolder(filePath);
        return { success: true };
      }
      return { success: false, error: 'No path provided' };
    } catch (e: any) {
      return { success: false, error: e?.message };
    }
  });

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

    if (newConfig.comfyui_folders !== undefined) {
      await dbManager.run(
        'INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?);',
        ['comfyui_folders', JSON.stringify(newConfig.comfyui_folders)]
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

    if (newConfig.strict_hash_verification !== undefined) {
      downloadManager.setStrictHashVerification(newConfig.strict_hash_verification);
      await dbManager.run(
        'INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?);',
        ['strict_hash_verification', JSON.stringify(newConfig.strict_hash_verification)]
      );
    }

    if (newConfig.max_concurrent_downloads !== undefined) {
      downloadManager.setMaxConcurrent(newConfig.max_concurrent_downloads);
      await dbManager.run(
        'INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?);',
        ['max_concurrent_downloads', JSON.stringify(newConfig.max_concurrent_downloads)]
      );
    }

    folderRouter.updateConfig({
      rootPath: currentConfig.comfyui_root,
      folderPaths: currentConfig.comfyui_folders,
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
  ipcMain.handle('scan-library', async (_event: unknown, rootPath: string | string[]) => {
    libraryScanner
      .scanDirectory(rootPath, (progress: any) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('scan-progress', progress);
        }
      })
      .catch((err) => {
        logger.error('Background folder scan error:', err);
      });
    return { success: true, status: 'scanning' };
  });

  ipcMain.handle('cancel-scan', () => {
    libraryScanner.cancelScan();
    return true;
  });

  ipcMain.handle('get-scan-status', () => {
    return libraryScanner.getScanStatus();
  });

  ipcMain.handle('get-local-models', async () => {
    const rows = await dbManager.all('SELECT * FROM local_models ORDER BY file_name ASC;');
    return rows.map((r: any) => ({
      id: r.id,
      filePath: r.file_path,
      fileName: r.file_name,
      fileSize: r.file_size,
      modifiedAt: r.modified_at,
      sha256: r.sha256,
      civitaiModelId: r.civitai_model_id,
      civitaiVersionId: r.civitai_version_id,
      previewUrl: r.preview_url,
      modelType: r.model_type,
      isMatched: !!r.civitai_version_id,
      hasUpdate: !!r.has_update,
      updateVersionId: r.update_version_id,
      updateVersionName: r.update_version_name,
      updateDownloadUrl: r.update_download_url,
      isDuplicate: !!r.is_duplicate,
    }));
  });

  // Download Handlers
  ipcMain.handle('add-download', async (_event: unknown, taskParams: any) => {
    let downloadUrl = taskParams.downloadUrl;
    if (taskParams.modelVersionId) {
      downloadUrl = civitaiClient.getDownloadUrl(taskParams.modelVersionId);
    } else if (currentConfig.civitai_api_key && downloadUrl && !downloadUrl.includes('token=')) {
      const sep = downloadUrl.includes('?') ? '&' : '?';
      downloadUrl = `${downloadUrl}${sep}token=${encodeURIComponent(currentConfig.civitai_api_key)}`;
    }

    const computed = folderRouter.computePath({
      fileName: taskParams.fileName,
      modelType: taskParams.modelType,
      baseModel: taskParams.baseModel,
      creator: taskParams.creator,
    });

    const task = downloadManager.addTask({
      ...taskParams,
      downloadUrl,
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

  ipcMain.handle('force-complete-download', async (_event: unknown, id: string) => {
    return await downloadManager.forceCompleteTask(id);
  });

  ipcMain.handle('get-downloads', () => {
    return downloadManager.getTasks();
  });

  // Fetch version history for a given model ID
  ipcMain.handle('fetch-versions', async (_event: unknown, modelId: number) => {
    try {
      const versions = await versionManager.getVersionHistory(modelId);
      return versions;
    } catch (e) {
      logger.error('Failed to fetch versions', e);
      return [];
    }
  });

  // Versioning & Backup
  ipcMain.handle('check-update', async (_event: unknown, localModel: any) => {
    return await versionManager.checkForUpdates(localModel);
  });

  ipcMain.handle('check-all-updates', async () => {
    return await versionManager.batchCheckAllUpdates((prog) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-check-progress', prog);
      }
    });
  });

  ipcMain.handle('export-backup', async (_event: unknown, filePath: string) => {
    await backupService.exportBackup(filePath);
    return true;
  });

  ipcMain.handle('import-backup', async (_event: unknown, filePath: string) => {
    await backupService.importBackup(filePath);
    return true;
  });
  // External Link & System Info
  ipcMain.handle('open-external', async (_event: unknown, url: string) => {
    if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
      await shell.openExternal(url);
      return true;
    }
    return false;
  });

  ipcMain.handle('get-system-info', () => {
    return {
      version: app.getVersion(),
      electronVersion: process.versions.electron,
      nodeVersion: process.versions.node,
      chromeVersion: process.versions.chrome,
      platform: process.platform,
      arch: process.arch,
    };
  });

  // App control
  ipcMain.handle('restart-app', () => {
    app.relaunch();
    app.exit(0);
    return true;
  });
  ipcMain.handle('shutdown-app', () => {
    app.quit();
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

// Forward backend main-process logs to renderer Diagnostic Console
logger.onLog((logPayload) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('app-log', logPayload);
  }
});

// Single Instance Lock: Ensure only one instance of the app runs at a time in production.
const gotTheLock = app.isPackaged ? app.requestSingleInstanceLock() : true;

if (!gotTheLock) {
  logger.info('Another instance of CivitAI Model Manager is already running. Focusing existing window and exiting.');
  app.quit();
} else {
  if (app.isPackaged) {
    app.on('second-instance', (_event, _commandLine, _workingDirectory) => {
      logger.info('Second instance detected. Restoring and focusing existing window.');
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isMinimized()) {
          mainWindow.restore();
        }
        mainWindow.show();
        mainWindow.focus();
      }
    });
  }

  app.whenReady().then(async () => {
    await dbManager.init();
    await loadConfigFromDb();
    registerIpcHandlers();
    startHttpBridgeServer();

    const isHeadless = process.env.HEADLESS === 'true' || app.commandLine.hasSwitch('headless');
    if (!isHeadless) {
      await createWindow();
    } else {
      logger.info('Running in headless background mode (no Electron desktop window created).');
    }

    if (app.isPackaged) {
      autoUpdater.checkForUpdatesAndNotify().catch((err) => {
        logger.warn('Auto-updater check failed:', err);
      });
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}
