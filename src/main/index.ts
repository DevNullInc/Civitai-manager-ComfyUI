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
import child_process from 'child_process';
import http from 'http';
import { dbManager } from '../db/db';
import { civitaiClient } from '../services/civitaiClient';
import { folderRouter } from '../services/folderRouter';
import { downloadManager } from '../services/downloadManager';
import { libraryScanner } from '../services/libraryScanner';
import { versionManager } from '../services/versionManager';
import { backupService } from '../services/backupService';
import { imageCacheService } from '../services/imageCacheService';
import { webhookService } from '../services/webhookService';
import { huggingfaceClient } from '../services/huggingfaceClient';
import { workflowScanner } from '../services/workflowScanner';
import { nodeResolverService } from '../services/nodeResolverService';
import { encryptKey, decryptKey } from '../utils/secureStorage';
import { logger } from '../utils/logger';
import { AppConfig } from '../types/app';

app.setName('civitai-model-manager');

let mainWindow: BrowserWindow | null = null;
let currentConfig: AppConfig = {
  comfyui_root: '',
  comfyui_folders: [],
  comfyui_install_dir: '',
  comfyui_custom_nodes_dir: '',
  civitai_api_key: '',
  mirror_url: '',
  huggingface_token: '',
  webhooks: {
    on_download_complete: '',
    on_update_available: '',
  },
  folder_mappings: {},
  advanced_mappings: { filename_patterns: [] },
  organize_by: { base_model: false, creator: false },
  conflict_strategy: 'rename',
  nsfw_max_visible_level: 5,
  nsfw_blur_enabled: true,
  local_api_enabled: true,
  local_api_port: 5174,
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
    if (cfgObj.comfyui_install_dir !== undefined) currentConfig.comfyui_install_dir = cfgObj.comfyui_install_dir;
    if (cfgObj.comfyui_custom_nodes_dir !== undefined) currentConfig.comfyui_custom_nodes_dir = cfgObj.comfyui_custom_nodes_dir;
    if ((!currentConfig.comfyui_folders || currentConfig.comfyui_folders.length === 0) && currentConfig.comfyui_root) {
      currentConfig.comfyui_folders = [currentConfig.comfyui_root];
    }
    if (cfgObj.civitai_api_key) {
      const decrypted = decryptKey(cfgObj.civitai_api_key);
      currentConfig.civitai_api_key = decrypted;
      civitaiClient.setApiKey(decrypted);
    }
    if (cfgObj.mirror_url !== undefined) {
      currentConfig.mirror_url = cfgObj.mirror_url;
      const baseApiUrl = (cfgObj.mirror_url && cfgObj.mirror_url.trim()) ? cfgObj.mirror_url.trim() : 'https://civitai.com/api/v1';
      civitaiClient.setBaseUrl(baseApiUrl);
    }
    if (cfgObj.huggingface_token) {
      const decryptedHf = decryptKey(cfgObj.huggingface_token);
      currentConfig.huggingface_token = decryptedHf;
      huggingfaceClient.setToken(decryptedHf);
    }
    if (cfgObj.webhooks) {
      currentConfig.webhooks = cfgObj.webhooks;
      webhookService.updateConfig(cfgObj.webhooks);
    }
    if (cfgObj.folder_mappings) currentConfig.folder_mappings = cfgObj.folder_mappings;
    if (cfgObj.advanced_mappings) currentConfig.advanced_mappings = cfgObj.advanced_mappings;
    if (cfgObj.organize_by) currentConfig.organize_by = cfgObj.organize_by;
    if (cfgObj.conflict_strategy) {
      currentConfig.conflict_strategy = cfgObj.conflict_strategy;
      downloadManager.setConflictStrategy(cfgObj.conflict_strategy);
    }
    if (cfgObj.nsfw_max_visible_level !== undefined) {
      currentConfig.nsfw_max_visible_level = cfgObj.nsfw_max_visible_level;
    }
    if (cfgObj.nsfw_blur_enabled !== undefined) {
      currentConfig.nsfw_blur_enabled = cfgObj.nsfw_blur_enabled;
    }
    if (cfgObj.strict_hash_verification !== undefined) {
      currentConfig.strict_hash_verification = cfgObj.strict_hash_verification;
      downloadManager.setStrictHashVerification(cfgObj.strict_hash_verification);
    }
    if (cfgObj.max_concurrent_downloads !== undefined) {
      currentConfig.max_concurrent_downloads = cfgObj.max_concurrent_downloads;
      downloadManager.setMaxConcurrent(cfgObj.max_concurrent_downloads);
    }
    if (cfgObj.default_download_folder !== undefined) {
      currentConfig.default_download_folder = cfgObj.default_download_folder;
    }
    if (cfgObj.local_api_enabled !== undefined) {
      currentConfig.local_api_enabled = cfgObj.local_api_enabled;
    }
    if (cfgObj.local_api_port !== undefined) {
      currentConfig.local_api_port = cfgObj.local_api_port;
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

function getSubdirectories(dirPath: string): string[] {
  try {
    if (!fs.existsSync(dirPath)) return [];
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory() && !e.name.startsWith('.') && e.name !== '__pycache__')
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

function inspectComfyUIInstall(installPath?: string) {
  const rawPath = (installPath || currentConfig.comfyui_install_dir || '').trim();

  // If no explicit path specified, infer from primary model folder (e.g. /path/to/ComfyUI/models -> /path/to/ComfyUI)
  if (!rawPath) {
    const primaryModelFolder = currentConfig.comfyui_root || (currentConfig.comfyui_folders && currentConfig.comfyui_folders[0]) || '';
    if (primaryModelFolder) {
      const parent = path.dirname(primaryModelFolder);
      const customNodesInParent = path.join(parent, 'custom_nodes');
      const hasMainPy = fs.existsSync(path.join(parent, 'main.py'));
      const hasCustomNodes = fs.existsSync(customNodesInParent);

      if (hasCustomNodes || hasMainPy) {
        const nodes = hasCustomNodes ? getSubdirectories(customNodesInParent) : [];
        return {
          valid: true,
          inferred: true,
          installDir: parent,
          customNodesDir: hasCustomNodes ? customNodesInParent : '',
          customNodesExist: hasCustomNodes,
          installedNodes: nodes,
          nodeCount: nodes.length,
        };
      }
    }
    return {
      valid: false,
      inferred: false,
      installDir: '',
      customNodesDir: '',
      customNodesExist: false,
      installedNodes: [],
      nodeCount: 0,
    };
  }

  const normalized = path.resolve(rawPath);
  const exists = fs.existsSync(normalized);
  if (!exists) {
    return {
      valid: false,
      inferred: false,
      installDir: normalized,
      customNodesDir: '',
      customNodesExist: false,
      installedNodes: [],
      nodeCount: 0,
    };
  }

  // Check if directory is custom_nodes itself or root ComfyUI directory
  let customNodesDir = path.join(normalized, 'custom_nodes');
  if (!fs.existsSync(customNodesDir) && path.basename(normalized).toLowerCase() === 'custom_nodes') {
    customNodesDir = normalized;
  }

  const customNodesExist = fs.existsSync(customNodesDir);
  const installedNodes = customNodesExist ? getSubdirectories(customNodesDir) : [];

  return {
    valid: true,
    inferred: false,
    installDir: normalized,
    customNodesDir: customNodesExist ? customNodesDir : '',
    customNodesExist,
    installedNodes,
    nodeCount: installedNodes.length,
  };
}

function startHttpBridgeServer() {
  const apiPort =
    parseInt(process.env.API_PORT || process.env.BRIDGE_PORT || process.env.CMM_PORT || '', 10) || 5174;

  const server = http.createServer(async (req, res) => {
    // Enforce strict localhost only (127.0.0.1 / ::1 / ::ffff:127.0.0.1)
    const remoteIp = req.socket.remoteAddress || '';
    const isLocal =
      remoteIp === '127.0.0.1' ||
      remoteIp === '::1' ||
      remoteIp === '::ffff:127.0.0.1' ||
      remoteIp.endsWith('127.0.0.1');

    if (!isLocal) {
      logger.warn(`Security: Blocked non-localhost HTTP bridge connection attempt from ${remoteIp}`);
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Access forbidden: Localhost (127.0.0.1) connections only' }));
      return;
    }

    // Origin header verification to guard against DNS rebinding & browser CSRF
    const origin = req.headers.origin;
    if (origin && !origin.includes('localhost') && !origin.includes('127.0.0.1') && !origin.startsWith('app://') && !origin.startsWith('file://')) {
      logger.warn(`Security: Blocked untrusted Origin header in HTTP bridge: ${origin}`);
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Access forbidden: Untrusted Origin' }));
      return;
    }

    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

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
      if ((url === '/api/status' || url === '/api/health') && req.method === 'GET') {
        const isApiEnabled = currentConfig.local_api_enabled !== false;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            status: isApiEnabled ? 'online' : 'disabled',
            enabled: isApiEnabled,
            name: 'CivitAI Model Manager',
            version: '1.3.0',
            port: apiPort,
            host: '127.0.0.1',
            localhostOnly: true,
          })
        );
        return;
      }

      // If Local API Bridge is disabled in settings, reject external API endpoints
      const pathname = url.split('?')[0];
      const isConfigEndpoint = pathname === '/api/config' || pathname === '/api/save-config';
      if (currentConfig.local_api_enabled === false && !isConfigEndpoint) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Local API Bridge is disabled in Settings.' }));
        return;
      }

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
        if (body.comfyui_install_dir !== undefined) {
          await dbManager.run(
            'INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?);',
            ['comfyui_install_dir', JSON.stringify(body.comfyui_install_dir)]
          );
        }
        if (body.comfyui_custom_nodes_dir !== undefined) {
          await dbManager.run(
            'INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?);',
            ['comfyui_custom_nodes_dir', JSON.stringify(body.comfyui_custom_nodes_dir)]
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
        if (body.mirror_url !== undefined) {
          const baseApiUrl = (body.mirror_url && body.mirror_url.trim()) ? body.mirror_url.trim() : 'https://civitai.com/api/v1';
          civitaiClient.setBaseUrl(baseApiUrl);
          await dbManager.run(
            'INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?);',
            ['mirror_url', JSON.stringify(body.mirror_url)]
          );
        }
        if (body.huggingface_token !== undefined) {
          const encryptedHf = encryptKey(body.huggingface_token);
          await dbManager.run(
            'INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?);',
            ['huggingface_token', JSON.stringify(encryptedHf)]
          );
          huggingfaceClient.setToken(body.huggingface_token);
        }
        if (body.webhooks !== undefined) {
          await dbManager.run(
            'INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?);',
            ['webhooks', JSON.stringify(body.webhooks)]
          );
          webhookService.updateConfig(body.webhooks);
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
        if (body.organize_by !== undefined) {
          await dbManager.run(
            'INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?);',
            ['organize_by', JSON.stringify(body.organize_by)]
          );
        }
        if (body.conflict_strategy !== undefined) {
          downloadManager.setConflictStrategy(body.conflict_strategy);
          await dbManager.run(
            'INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?);',
            ['conflict_strategy', JSON.stringify(body.conflict_strategy)]
          );
        }
        if (body.nsfw_max_visible_level !== undefined) {
          await dbManager.run(
            'INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?);',
            ['nsfw_max_visible_level', JSON.stringify(body.nsfw_max_visible_level)]
          );
        }
        if (body.nsfw_blur_enabled !== undefined) {
          await dbManager.run(
            'INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?);',
            ['nsfw_blur_enabled', JSON.stringify(body.nsfw_blur_enabled)]
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

        if (body.default_download_folder !== undefined) {
          await dbManager.run(
            'INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?);',
            ['default_download_folder', JSON.stringify(body.default_download_folder)]
          );
        }

        if (body.local_api_enabled !== undefined) {
          await dbManager.run(
            'INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?);',
            ['local_api_enabled', JSON.stringify(body.local_api_enabled)]
          );
        }

        if (body.local_api_port !== undefined) {
          await dbManager.run(
            'INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?);',
            ['local_api_port', JSON.stringify(body.local_api_port)]
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
      } else if (url === '/api/comfyui-install' && req.method === 'GET') {
        const result = inspectComfyUIInstall();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } else if (url === '/api/check-comfyui-install' && req.method === 'POST') {
        const body = await getBody();
        const result = inspectComfyUIInstall(body.installPath || body.path);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } else if ((url === '/api/nodes/resolve' || url.startsWith('/api/nodes/resolve?')) && (req.method === 'GET' || req.method === 'POST')) {
        let nodeType = '';
        if (req.method === 'GET') {
          const parsedUrl = new URL(url, `http://${req.headers.host || 'localhost'}`);
          nodeType = parsedUrl.searchParams.get('nodeType') || parsedUrl.searchParams.get('type') || '';
        } else {
          const body = await getBody();
          nodeType = body.nodeType || body.type || body.name || '';
        }
        const targetNodesDir =
          currentConfig.comfyui_custom_nodes_dir ||
          (currentConfig.comfyui_install_dir ? path.join(currentConfig.comfyui_install_dir, 'custom_nodes') : '') ||
          (currentConfig.comfyui_folders?.[0] ? path.join(path.dirname(currentConfig.comfyui_folders[0]), 'custom_nodes') : '');
        const resolution = await nodeResolverService.resolveMissingNode(
          nodeType,
          targetNodesDir,
          currentConfig.comfyui_install_dir
        );
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(resolution));
      } else if (url === '/api/nodes/search-github' && req.method === 'POST') {
        const body = await getBody();
        const query = body.query || body.q || '';
        const limit = parseInt(body.limit, 10) || 3;
        const candidates = await nodeResolverService.searchGitHubNodes(query, limit);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ query, candidates }));
      } else if (url === '/api/nodes/clone' && req.method === 'POST') {
        const body = await getBody();
        const targetNodesDir =
          body.customNodesDir ||
          currentConfig.comfyui_custom_nodes_dir ||
          (currentConfig.comfyui_install_dir ? path.join(currentConfig.comfyui_install_dir, 'custom_nodes') : '') ||
          (currentConfig.comfyui_folders?.[0] ? path.join(path.dirname(currentConfig.comfyui_folders[0]), 'custom_nodes') : '');
        const cloneRes = await nodeResolverService.cloneCustomNode(
          body.gitUrl,
          targetNodesDir,
          currentConfig.comfyui_install_dir,
          body.folderName
        );
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(cloneRes));
      } else if (url === '/api/nodes/install-deps' && req.method === 'POST') {
        const body = await getBody();
        const depRes = await nodeResolverService.installNodeDependencies(
          body.folderPath || body.targetPath,
          currentConfig.comfyui_install_dir
        );
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(depRes));
      } else if (url === '/api/nodes/installed' && req.method === 'GET') {
        const targetNodesDir =
          currentConfig.comfyui_custom_nodes_dir ||
          (currentConfig.comfyui_install_dir ? path.join(currentConfig.comfyui_install_dir, 'custom_nodes') : '') ||
          (currentConfig.comfyui_folders?.[0] ? path.join(path.dirname(currentConfig.comfyui_folders[0]), 'custom_nodes') : '');
        const pkgs = await nodeResolverService.inspectLocalCustomNodes(targetNodesDir);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(pkgs));
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
            logger.error('Error during HTTP library scan:', err);
          });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Scan started in background' }));
      } else if (url === '/api/cancel-scan' && req.method === 'POST') {
        libraryScanner.cancelScan();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Scan cancellation requested' }));
      } else if (url === '/api/models' && req.method === 'GET') {
        const parsedUrl = new URL(url, `http://${req.headers.host}`);
        const params = Object.fromEntries(parsedUrl.searchParams.entries());
        const data = await civitaiClient.fetchModels(params);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      } else if (url.startsWith('/api/model/') && req.method === 'GET') {
        const id = parseInt(url.split('/')[3], 10);
        const data = await civitaiClient.fetchModel(id);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      } else if (url.startsWith('/api/version/') && req.method === 'GET') {
        const id = parseInt(url.split('/')[3], 10);
        const data = await civitaiClient.fetchModelVersion(id);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
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
        const effectiveRoot = body.targetRoot || currentConfig.default_download_folder || currentConfig.comfyui_root || (currentConfig.comfyui_folders && currentConfig.comfyui_folders[0]);
        const computed = folderRouter.computePath({
          fileName: body.fileName,
          modelType: body.modelType,
          baseModel: body.baseModel,
          creator: body.creator,
          targetRoot: effectiveRoot,
        });
        const task = downloadManager.addTask({
          ...body,
          downloadUrl,
          targetFolder: computed.folderName,
          targetRoot: effectiveRoot,
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
        const deleteFromDisk = body.deleteFromDisk !== false;
        if (!model) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Model not found' }));
        } else {
          try {
            if (deleteFromDisk && fs.existsSync(model.file_path)) {
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
        if (body.filePath && typeof body.filePath === 'string') {
          try {
            shell.showItemInFolder(path.resolve(body.filePath));
          } catch (e) {
            logger.warn('Failed to show item in folder via HTTP:', e);
          }
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
      } else if (url === '/api/ignore-model-update' && req.method === 'POST') {
        const body = await getBody();
        const success = await versionManager.ignoreUpdate(body.modelId, body.versionId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success }));
      } else if (url === '/api/unignore-model-update' && req.method === 'POST') {
        const body = await getBody();
        const success = await versionManager.unignoreUpdate(body.modelId, body.versionId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success }));
      } else if (url === '/api/get-ignored-updates' && req.method === 'GET') {
        const ignored = await versionManager.getIgnoredUpdates();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(ignored));
      } else if (url === '/api/ignore-duplicate-set' && req.method === 'POST') {
        const body = await getBody();
        const success = await libraryScanner.ignoreDuplicateSet(body.sha256, body.count || 2);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success }));
      } else if (url === '/api/unignore-duplicate-set' && req.method === 'POST') {
        const body = await getBody();
        const success = await libraryScanner.unignoreDuplicateSet(body.sha256);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success }));
      } else if (url === '/api/set-model-nsfw' && req.method === 'POST') {
        const body = await getBody();
        if (body.modelId) {
          await dbManager.run('UPDATE local_models SET nsfw = ? WHERE id = ?', [body.nsfw ? 1 : 0, body.modelId]);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } else if (url === '/api/get-ignored-duplicates' && req.method === 'GET') {
        const ignored = await libraryScanner.getIgnoredDuplicates();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(ignored));
      } else if (url === '/api/match-unidentified-models' && req.method === 'POST') {
        const result = await libraryScanner.matchUnidentifiedModels();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } else if (url === '/api/export-backup-zip' && req.method === 'GET') {
        const zipBuffer = await backupService.createBackupZip();
        const filename = `cmm-backup-${new Date().toISOString().slice(0, 10)}.zip`;
        res.writeHead(200, {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': zipBuffer.length,
        });
        res.end(zipBuffer);
        return;
      } else if (url === '/api/import-backup-zip' && req.method === 'POST') {
        const chunks: Buffer[] = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', async () => {
          try {
            const fullBuffer = Buffer.concat(chunks);
            const result = await backupService.restoreBackup(fullBuffer);
            await libraryScanner.flagDuplicates();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          } catch (e: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: e.message }));
          }
        });
        return;
      } else if (url.startsWith('/api/cached-image') && req.method === 'GET') {
        const parsedUrl = new URL(url, `http://${req.headers.host || 'localhost:5174'}`);
        const targetUrl = parsedUrl.searchParams.get('url');
        const cacheType = (parsedUrl.searchParams.get('type') || 'library') as 'library' | 'browse';

        if (!targetUrl) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing url parameter' }));
          return;
        }

        const image = await imageCacheService.getImage(targetUrl, cacheType);
        if (image) {
          res.writeHead(200, {
            'Content-Type': image.contentType,
            'Cache-Control': cacheType === 'library' ? 'public, max-age=31536000, immutable' : 'public, max-age=86400',
            'Content-Length': image.buffer.length,
          });
          res.end(image.buffer);
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Image not found or failed to download' }));
        }
        return;
      } else if (url === '/api/clear-library' && req.method === 'POST') {
        await dbManager.run('DELETE FROM local_models;');
        imageCacheService.clearPermanentLibraryCache();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } else if ((url === '/api/workflows' || url === '/api/workflow/parse' || url === '/api/parse-workflow') && req.method === 'POST') {
        const body = await getBody();

        // 1. Direct raw JSON workflow payload in POST body
        const isDirectWorkflow =
          body.workflow !== undefined ||
          body.prompt !== undefined ||
          body.nodes !== undefined ||
          (typeof body === 'object' && !body.folderPaths && !body.folderPath && !body.path && Object.keys(body).length > 0 && !Array.isArray(body));

        if (isDirectWorkflow && !body.folderPaths && !body.folderPath && !body.path) {
          const rawData = body.workflow !== undefined ? body.workflow : (body.prompt !== undefined ? body.prompt : body);
          const workflowName = body.name || body.fileName || 'direct_workflow.json';
          const result = await workflowScanner.parseWorkflow(rawData, workflowName);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
          return;
        }

        // 2. Folder paths fallback for disk scanning
        const folderPaths = body.folderPaths || body.folderPath || body.path || currentConfig.comfyui_folders || [currentConfig.comfyui_root];
        const workflows = await workflowScanner.scanWorkflows(folderPaths);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(workflows));
      } else if (url === '/api/webhooks/test' && req.method === 'POST') {
        const body = await getBody();
        const result = await webhookService.testWebhook(body.url, body.event);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } else if (url === '/api/hf/check' && req.method === 'POST') {
        const body = await getBody();
        const result = await huggingfaceClient.checkModelRepo(body.repoId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } else if (url === '/api/hf/validate-token' && req.method === 'POST') {
        const body = await getBody();
        const result = await huggingfaceClient.validateToken(body.token);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } else if (url === '/api/hf/whoami' && req.method === 'GET') {
        const result = await huggingfaceClient.getCliWhoami();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } else if (url === '/api/restart-app' && req.method === 'POST') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        setTimeout(() => performLiveRestart(), 500);
      } else if (url === '/api/shutdown-app' && req.method === 'POST') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        setTimeout(() => performFullShutdown(), 500);
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
      logger.warn(`Port ${apiPort} is already in use by an active instance. Reusing existing bridge connection.`);
    } else {
      logger.error('HTTP Server bridge error:', err);
    }
  });

  server.listen(apiPort, '127.0.0.1', () => {
    logger.info(`HTTP Native Server Bridge securely listening on http://127.0.0.1:${apiPort} (Localhost only)`);
  });
}

function registerIpcHandlers() {
  ipcMain.handle('get-config', () => currentConfig);

  // Clear library cache from SQLite
  ipcMain.handle('clear-library', async () => {
    try {
      await dbManager.run('DELETE FROM local_models;');
      imageCacheService.clearPermanentLibraryCache();
      logger.info('Library cache cleared from database.');
      return { success: true };
    } catch (e: any) {
      logger.error('Failed to clear library database:', e);
      return { success: false, error: e?.message || 'Unknown error' };
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

    if (newConfig.comfyui_install_dir !== undefined) {
      await dbManager.run(
        'INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?);',
        ['comfyui_install_dir', JSON.stringify(newConfig.comfyui_install_dir)]
      );
    }

    if (newConfig.comfyui_custom_nodes_dir !== undefined) {
      await dbManager.run(
        'INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?);',
        ['comfyui_custom_nodes_dir', JSON.stringify(newConfig.comfyui_custom_nodes_dir)]
      );
    }

    if (newConfig.mirror_url !== undefined) {
      const baseApiUrl = (newConfig.mirror_url && newConfig.mirror_url.trim()) ? newConfig.mirror_url.trim() : 'https://civitai.com/api/v1';
      civitaiClient.setBaseUrl(baseApiUrl);
      await dbManager.run(
        'INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?);',
        ['mirror_url', JSON.stringify(newConfig.mirror_url)]
      );
    }

    if (newConfig.huggingface_token !== undefined) {
      const encryptedHf = encryptKey(newConfig.huggingface_token);
      await dbManager.run(
        'INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?);',
        ['huggingface_token', JSON.stringify(encryptedHf)]
      );
      huggingfaceClient.setToken(newConfig.huggingface_token);
    }

    if (newConfig.webhooks !== undefined) {
      await dbManager.run(
        'INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?);',
        ['webhooks', JSON.stringify(newConfig.webhooks)]
      );
      webhookService.updateConfig(newConfig.webhooks);
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

    if (newConfig.organize_by !== undefined) {
      await dbManager.run(
        'INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?);',
        ['organize_by', JSON.stringify(newConfig.organize_by)]
      );
    }

    if (newConfig.conflict_strategy !== undefined) {
      downloadManager.setConflictStrategy(newConfig.conflict_strategy);
      await dbManager.run(
        'INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?);',
        ['conflict_strategy', JSON.stringify(newConfig.conflict_strategy)]
      );
    }

    if (newConfig.nsfw_max_visible_level !== undefined) {
      await dbManager.run(
        'INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?);',
        ['nsfw_max_visible_level', JSON.stringify(newConfig.nsfw_max_visible_level)]
      );
    }

    if (newConfig.nsfw_blur_enabled !== undefined) {
      await dbManager.run(
        'INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?);',
        ['nsfw_blur_enabled', JSON.stringify(newConfig.nsfw_blur_enabled)]
      );
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

    if (newConfig.default_download_folder !== undefined) {
      await dbManager.run(
        'INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?);',
        ['default_download_folder', JSON.stringify(newConfig.default_download_folder)]
      );
    }

    if (newConfig.local_api_enabled !== undefined) {
      await dbManager.run(
        'INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?);',
        ['local_api_enabled', JSON.stringify(newConfig.local_api_enabled)]
      );
    }

    if (newConfig.local_api_port !== undefined) {
      await dbManager.run(
        'INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?);',
        ['local_api_port', JSON.stringify(newConfig.local_api_port)]
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

  // Workflow Handlers
  ipcMain.handle('scan-workflows', async (_event: unknown, folderPaths?: string | string[]) => {
    const paths = folderPaths || currentConfig.comfyui_folders || [currentConfig.comfyui_root];
    return await workflowScanner.scanWorkflows(paths);
  });

  // ComfyUI Installation & Custom Node Inspection
  ipcMain.handle('inspect-comfyui-install', async (_event: unknown, targetPath?: string) => {
    return inspectComfyUIInstall(targetPath);
  });

  // Node Resolution & GitHub Fallback Handlers
  ipcMain.handle('resolve-missing-node', async (_event: unknown, nodeType: string, customNodesDir?: string) => {
    const targetNodesDir =
      customNodesDir ||
      currentConfig.comfyui_custom_nodes_dir ||
      (currentConfig.comfyui_install_dir ? path.join(currentConfig.comfyui_install_dir, 'custom_nodes') : '') ||
      (currentConfig.comfyui_folders?.[0] ? path.join(path.dirname(currentConfig.comfyui_folders[0]), 'custom_nodes') : '');
    return await nodeResolverService.resolveMissingNode(
      nodeType,
      targetNodesDir,
      currentConfig.comfyui_install_dir
    );
  });

  ipcMain.handle('search-github-nodes', async (_event: unknown, query: string, limit = 3) => {
    return await nodeResolverService.searchGitHubNodes(query, limit);
  });

  ipcMain.handle('clone-custom-node', async (_event: unknown, gitUrl: string, customFolderName?: string) => {
    const targetNodesDir =
      currentConfig.comfyui_custom_nodes_dir ||
      (currentConfig.comfyui_install_dir ? path.join(currentConfig.comfyui_install_dir, 'custom_nodes') : '') ||
      (currentConfig.comfyui_folders?.[0] ? path.join(path.dirname(currentConfig.comfyui_folders[0]), 'custom_nodes') : '');
    return await nodeResolverService.cloneCustomNode(
      gitUrl,
      targetNodesDir,
      currentConfig.comfyui_install_dir,
      customFolderName
    );
  });

  ipcMain.handle('install-node-dependencies', async (_event: unknown, nodeFolderPath: string) => {
    return await nodeResolverService.installNodeDependencies(nodeFolderPath, currentConfig.comfyui_install_dir);
  });

  ipcMain.handle('get-installed-custom-nodes', async () => {
    const targetNodesDir =
      currentConfig.comfyui_custom_nodes_dir ||
      (currentConfig.comfyui_install_dir ? path.join(currentConfig.comfyui_install_dir, 'custom_nodes') : '') ||
      (currentConfig.comfyui_folders?.[0] ? path.join(path.dirname(currentConfig.comfyui_folders[0]), 'custom_nodes') : '');
    return await nodeResolverService.inspectLocalCustomNodes(targetNodesDir);
  });

  // Webhook Handlers
  ipcMain.handle('test-webhook', async (_event: unknown, url: string, event: 'on_download_complete' | 'on_update_available') => {
    return await webhookService.testWebhook(url, event);
  });

  // Hugging Face Handlers
  ipcMain.handle('hf-check-model', async (_event: unknown, repoId: string) => {
    return await huggingfaceClient.checkModelRepo(repoId);
  });

  ipcMain.handle('hf-validate-token', async (_event: unknown, token?: string) => {
    return await huggingfaceClient.validateToken(token);
  });

  ipcMain.handle('hf-whoami', async () => {
    return await huggingfaceClient.getCliWhoami();
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

  ipcMain.handle('match-unidentified-models', async () => {
    return await libraryScanner.matchUnidentifiedModels();
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
      civitaiName: r.civitai_name || undefined,
      previewUrl: r.preview_url,
      modelType: r.model_type,
      nsfw: !!r.nsfw,
      isMatched: !!r.civitai_version_id,
      hasUpdate: !!r.has_update,
      updateVersionId: r.update_version_id,
      updateVersionName: r.update_version_name,
      updateDownloadUrl: r.update_download_url,
      ignoredVersionId: r.ignored_version_id,
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

    const effectiveRoot = taskParams.targetRoot || currentConfig.default_download_folder || currentConfig.comfyui_root || (currentConfig.comfyui_folders && currentConfig.comfyui_folders[0]);
    const computed = folderRouter.computePath({
      fileName: taskParams.fileName,
      modelType: taskParams.modelType,
      baseModel: taskParams.baseModel,
      creator: taskParams.creator,
      targetRoot: effectiveRoot,
    });

    const task = downloadManager.addTask({
      ...taskParams,
      downloadUrl,
      targetFolder: computed.folderName,
      targetRoot: effectiveRoot,
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

  ipcMain.handle('ignore-model-update', async (_event: unknown, modelId: number, versionId: number) => {
    return await versionManager.ignoreUpdate(modelId, versionId);
  });

  ipcMain.handle('unignore-model-update', async (_event: unknown, modelId: number, versionId: number) => {
    return await versionManager.unignoreUpdate(modelId, versionId);
  });

  ipcMain.handle('get-ignored-updates', async () => {
    return await versionManager.getIgnoredUpdates();
  });

  ipcMain.handle('export-backup', async (_event: unknown, targetFilePath?: string) => {
    try {
      let dest = targetFilePath;
      if (!dest) {
        const { dialog } = require('electron');
        const defaultName = `cmm-backup-${new Date().toISOString().slice(0, 10)}.zip`;
        const result = await dialog.showSaveDialog({
          title: 'Save Complete CMM Backup Archive (.zip)',
          defaultPath: defaultName,
          filters: [
            { name: 'ZIP Archive (*.zip)', extensions: ['zip'] },
            { name: 'All Files (*.*)', extensions: ['*'] },
          ],
        });
        if (result.canceled || !result.filePath) return { success: false, canceled: true };
        dest = result.filePath;
      }
      if (!dest) {
        return { success: false, canceled: true };
      }
      await backupService.exportBackup(dest);
      return { success: true, filePath: dest };
    } catch (e: any) {
      logger.error('Failed to export backup:', e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('import-backup', async (_event: unknown, sourceFilePath?: string | Buffer) => {
    try {
      let src = sourceFilePath;
      if (!src) {
        const { dialog } = require('electron');
        const result = await dialog.showOpenDialog({
          title: 'Select CMM Backup Archive to Restore',
          properties: ['openFile'],
          filters: [
            { name: 'CMM Backup (*.zip, *.json)', extensions: ['zip', 'json'] },
            { name: 'All Files (*.*)', extensions: ['*'] },
          ],
        });
        if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
          return { success: false, canceled: true };
        }
        src = result.filePaths[0];
      }
      if (!src) {
        return { success: false, canceled: true };
      }
      const restoreResult = await backupService.restoreBackup(src);
      await libraryScanner.flagDuplicates();
      return restoreResult;
    } catch (e: any) {
      logger.error('Failed to import backup:', e);
      return { success: false, error: e.message };
    }
  });
  ipcMain.handle('delete-local-model', async (_event: unknown, id: string, deleteFromDisk: boolean = true) => {
    const model = await dbManager.get('SELECT * FROM local_models WHERE id = ?', [id]);
    if (!model) {
      return { success: false, error: 'Model not found' };
    }
    try {
      if (deleteFromDisk && fs.existsSync(model.file_path)) {
        fs.unlinkSync(model.file_path);
      }
      await dbManager.run('DELETE FROM local_models WHERE id = ?', [id]);
      await libraryScanner.flagDuplicates();
      return { success: true };
    } catch (delErr: any) {
      logger.error(`Failed to delete local model ${id}:`, delErr);
      return { success: false, error: delErr.message };
    }
  });

  ipcMain.handle('open-folder', async (_event: unknown, filePath: string) => {
    if (filePath && typeof filePath === 'string') {
      try {
        shell.showItemInFolder(path.resolve(filePath));
        return true;
      } catch (e) {
        logger.warn('Failed to show item in folder via IPC:', e);
      }
    }
    return false;
  });

  ipcMain.handle('ignore-duplicate-set', async (_event: unknown, sha256: string, count: number = 2) => {
    return await libraryScanner.ignoreDuplicateSet(sha256, count);
  });

  ipcMain.handle('unignore-duplicate-set', async (_event: unknown, sha256: string) => {
    return await libraryScanner.unignoreDuplicateSet(sha256);
  });

  ipcMain.handle('get-ignored-duplicates', async () => {
    return await libraryScanner.getIgnoredDuplicates();
  });

  ipcMain.handle('set-model-nsfw', async (_event: unknown, modelId: string, nsfw: boolean) => {
    if (modelId) {
      await dbManager.run('UPDATE local_models SET nsfw = ? WHERE id = ?', [nsfw ? 1 : 0, modelId]);
      return true;
    }
    return false;
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
  ipcMain.handle('restart-app', async () => {
    return await performLiveRestart();
  });
  ipcMain.handle('shutdown-app', () => {
    performFullShutdown();
    return true;
  });
}

async function performLiveRestart() {
  logger.info('Performing live backend restart & frontend refresh...');
  try {
    // 1. Re-load and apply all configuration from SQLite
    await loadConfigFromDb();

    // 2. Re-initialize and sync backend services
    if (currentConfig.civitai_api_key) {
      civitaiClient.setApiKey(currentConfig.civitai_api_key);
    }
    downloadManager.setConflictStrategy(currentConfig.conflict_strategy);
    downloadManager.setStrictHashVerification(currentConfig.strict_hash_verification !== false);
    downloadManager.setMaxConcurrent(currentConfig.max_concurrent_downloads || 2);

    folderRouter.updateConfig({
      rootPath: currentConfig.comfyui_root || (currentConfig.comfyui_folders && currentConfig.comfyui_folders[0]) || '',
      folderPaths: currentConfig.comfyui_folders,
      folderMappings: currentConfig.folder_mappings,
      separateByBaseModel: currentConfig.organize_by.base_model,
      separateByCreator: currentConfig.organize_by.creator,
      advancedMappings: currentConfig.advanced_mappings,
    });

    // 3. Refresh Electron frontend window live without terminating the OS window
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.reloadIgnoringCache();
    }
    logger.info('Live restart completed successfully.');
    return true;
  } catch (err) {
    logger.error('Error during live restart:', err);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.reloadIgnoringCache();
    }
    return false;
  }
}

function performFullShutdown() {
  logger.info('Performing full application shutdown and cleanup...');

  // 1. Read PID file (.cmm.pid) if exists
  const pidFilePath = path.join(process.cwd(), '.cmm.pid');
  const pidsToKill = new Set<number>();

  if (fs.existsSync(pidFilePath)) {
    try {
      const content = fs.readFileSync(pidFilePath, 'utf8');
      content.split(/\r?\n/).forEach((line) => {
        const pid = parseInt(line.trim(), 10);
        if (!isNaN(pid) && pid > 0 && pid !== process.pid) {
          pidsToKill.add(pid);
        }
      });
      fs.unlinkSync(pidFilePath);
    } catch (e) {}
  }

  // 2. Kill spawned background processes (like Vite dev server)
  if (process.platform === 'win32') {
    for (const pid of pidsToKill) {
      try {
        child_process.execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
      } catch (e) {}
    }
    // Also clean up any lingering process holding port 5173 or 5174
    try {
      child_process.execSync(
        `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 5173,5174 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { if ($_ -and $_ -ne ${process.pid}) { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue } }"`,
        { stdio: 'ignore' }
      );
    } catch (e) {}
  } else {
    for (const pid of pidsToKill) {
      try {
        process.kill(pid, 'SIGKILL');
      } catch (e) {}
    }
  }

  app.quit();
  setTimeout(() => {
    process.exit(0);
  }, 300);
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

// Single Instance Lock: Ensure only one instance of the app runs at a time.
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  logger.info('Another instance of CivitAI Model Manager is already running. Focusing existing window and exiting.');
  app.quit();
} else {
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
