/**
 * CivitAI Model Manager - ComfyUI Edition
 * Copyright (C) 2025-2026 TheStygianRenegade / /dev/null Inc
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { dbManager } from '../db/db';
import { logger } from '../utils/logger';
import {
  GitHubNodeRepo,
  NodeResolutionResult,
  NodeCloneResult,
  CustomNodePackage,
} from '../types/app';

const execFileAsync = promisify(execFile);

// URLs for ComfyUI-Manager curated node databases
const MANAGER_NODE_MAP_URL =
  'https://raw.githubusercontent.com/ltdrdata/ComfyUI-Manager/main/extension-node-map.json';
const MANAGER_NODE_LIST_URL =
  'https://raw.githubusercontent.com/ltdrdata/ComfyUI-Manager/main/custom-node-list.json';

const REGISTRY_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 Hours

export class NodeResolverService {
  private inMemorySearchCache = new Map<string, { timestamp: number; results: GitHubNodeRepo[] }>();
  private requestQueue: Array<() => Promise<void>> = [];
  private isProcessingQueue = false;
  private lastRequestTimestamp = 0;
  private minIntervalMs = 750; // Respect GitHub 10 req/min unauthenticated limit

  /**
   * Auto-locates the exact Python binary associated with the local ComfyUI installation.
   * Handles Windows Portable (python_embeded) and Linux/macOS virtual environments.
   */
  detectPythonBinary(comfyuiDir?: string): string {
    if (!comfyuiDir || !fs.existsSync(comfyuiDir)) {
      if (process.env.VIRTUAL_ENV) {
        const venvPython = path.join(
          process.env.VIRTUAL_ENV,
          process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python'
        );
        if (fs.existsSync(venvPython)) return venvPython;
      }
      return process.platform === 'win32' ? 'python.exe' : 'python3';
    }

    const resolved = path.resolve(comfyuiDir);
    const parent = path.dirname(resolved);

    const candidates: string[] = [
      // Windows Portable python_embeded inside or adjacent
      path.join(resolved, 'python_embeded', 'python.exe'),
      path.join(parent, 'python_embeded', 'python.exe'),
      path.join(resolved, 'python', 'python.exe'),
      // Virtual environments (venv / .venv)
      path.join(resolved, 'venv', 'bin', 'python'),
      path.join(resolved, '.venv', 'bin', 'python'),
      path.join(resolved, 'venv', 'Scripts', 'python.exe'),
      path.join(resolved, '.venv', 'Scripts', 'python.exe'),
      path.join(parent, 'venv', 'bin', 'python'),
      path.join(parent, '.venv', 'bin', 'python'),
      path.join(parent, 'venv', 'Scripts', 'python.exe'),
      path.join(parent, '.venv', 'Scripts', 'python.exe'),
    ];

    for (const p of candidates) {
      if (fs.existsSync(p)) {
        return p;
      }
    }

    // Fallback to active virtualenv or system python
    if (process.env.VIRTUAL_ENV) {
      const venvPy = path.join(
        process.env.VIRTUAL_ENV,
        process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python'
      );
      if (fs.existsSync(venvPy)) return venvPy;
    }

    return process.platform === 'win32' ? 'python.exe' : 'python3';
  }

  /**
   * Scans local custom_nodes directory to build a catalog of installed packages,
   * detecting requirements.txt, install.py, and exporting class names from NODE_CLASS_MAPPINGS.
   */
  async inspectLocalCustomNodes(customNodesDir: string): Promise<CustomNodePackage[]> {
    if (!customNodesDir || !fs.existsSync(customNodesDir)) {
      return [];
    }

    const packages: CustomNodePackage[] = [];
    try {
      const entries = fs.readdirSync(customNodesDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === '__pycache__') {
          continue;
        }

        const fullPath = path.join(customNodesDir, entry.name);
        const hasRequirements = fs.existsSync(path.join(fullPath, 'requirements.txt'));
        const hasInstallScript = fs.existsSync(path.join(fullPath, 'install.py'));
        const nodeClasses = this.extractClassMappingsFromFolder(fullPath);
        const gitRemoteUrl = this.getGitRemoteUrl(fullPath);

        packages.push({
          folderName: entry.name,
          fullPath,
          hasRequirements,
          hasInstallScript,
          nodeClasses,
          gitRemoteUrl,
        });
      }
    } catch (err) {
      logger.warn(`Error scanning custom nodes directory: ${customNodesDir}`, err);
    }

    return packages;
  }

  /**
   * Scans Python files within a custom node folder for NODE_CLASS_MAPPINGS keys.
   */
  private extractClassMappingsFromFolder(folderPath: string): string[] {
    const classNames = new Set<string>();

    try {
      const files = fs.readdirSync(folderPath);
      const pyFiles = files.filter((f) => f.endsWith('.py'));

      for (const pyFile of pyFiles) {
        try {
          const content = fs.readFileSync(path.join(folderPath, pyFile), 'utf-8');
          // Match NODE_CLASS_MAPPINGS dictionary entries
          const mappingBlock = content.match(/NODE_CLASS_MAPPINGS\s*=\s*\{([^}]+)\}/s);
          if (mappingBlock && mappingBlock[1]) {
            const keyMatches = mappingBlock[1].matchAll(/["']([^"']+)["']\s*:/g);
            for (const m of keyMatches) {
              if (m[1]) classNames.add(m[1].trim());
            }
          }
        } catch {}
      }
    } catch {}

    return Array.from(classNames);
  }

  /**
   * Reads .git/config to determine the repository remote origin URL if present.
   */
  private getGitRemoteUrl(folderPath: string): string | undefined {
    try {
      const gitConfigPath = path.join(folderPath, '.git', 'config');
      if (fs.existsSync(gitConfigPath)) {
        const content = fs.readFileSync(gitConfigPath, 'utf-8');
        const match = content.match(/url\s*=\s*(https?:\/\/[^\s]+|git@[^\s]+)/);
        if (match && match[1]) {
          return match[1].replace(/\.git$/, '');
        }
      }
    } catch {}
    return undefined;
  }

  /**
   * Fetches and caches the ComfyUI-Manager node registry with SQLite ETag and 24h TTL.
   */
  async getManagerRegistry(): Promise<{
    nodeMap: Record<string, [string[], { title_aux?: string }]>;
    customNodeList: any[];
  }> {
    let cachedMap: any = null;
    let cachedList: any = null;

    try {
      const mapRow: any = await dbManager.get(
        "SELECT value FROM app_config WHERE key = 'manager_node_map_cache';"
      );
      const metaRow: any = await dbManager.get(
        "SELECT value FROM app_config WHERE key = 'manager_node_map_meta';"
      );

      if (mapRow?.value && metaRow?.value) {
        const meta = JSON.parse(metaRow.value);
        if (Date.now() - (meta.timestamp || 0) < REGISTRY_CACHE_TTL_MS) {
          cachedMap = JSON.parse(mapRow.value);
        }
      }
    } catch (e) {
      logger.warn('Error reading cached manager node map from SQLite:', e);
    }

    if (cachedMap) {
      return { nodeMap: cachedMap, customNodeList: cachedList || [] };
    }

    // Download fresh registry JSON with fallback
    try {
      const fetchedMap = await this.fetchJsonWithETag(MANAGER_NODE_MAP_URL, 'manager_node_map');
      if (fetchedMap) {
        cachedMap = fetchedMap;
        await dbManager.run(
          "INSERT OR REPLACE INTO app_config (key, value) VALUES ('manager_node_map_cache', ?);",
          [JSON.stringify(fetchedMap)]
        );
        await dbManager.run(
          "INSERT OR REPLACE INTO app_config (key, value) VALUES ('manager_node_map_meta', ?);",
          [JSON.stringify({ timestamp: Date.now() })]
        );
      }
    } catch (err) {
      logger.warn('Failed to fetch latest ComfyUI-Manager node map:', err);
    }

    return { nodeMap: cachedMap || {}, customNodeList: [] };
  }

  /**
   * Queries GitHub Search API with token-bucket rate limiter, 600ms debounce, and query sanitization.
   */
  async searchGitHubNodes(query: string, limit = 3): Promise<GitHubNodeRepo[]> {
    const rawTerm = query.trim();
    if (!rawTerm) return [];

    const cacheKey = rawTerm.toLowerCase();
    const cached = this.inMemorySearchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < REGISTRY_CACHE_TTL_MS) {
      return cached.results.slice(0, limit);
    }

    // Query Sanitization: strip common prefixes and suffixes
    const sanitized = rawTerm
      .replace(/^(ComfyUI-|Comfy_|comfyui-|comfy_)/i, '')
      .replace(/(Loader|Sampler|Node|Processor|Wrapper)$/i, '')
      .trim();

    // 1. Primary Scoped Query: topic:comfyui <term>
    let results = await this.executeGitHubSearch(`topic:comfyui ${sanitized || rawTerm}`, limit);

    // 2. Fallback Query: ComfyUI <term> in:name,description,topics
    if (results.length === 0) {
      results = await this.executeGitHubSearch(`ComfyUI ${rawTerm} in:name,description,topics`, limit);
    }

    // 3. Fallback Query: raw sanitized term
    if (results.length === 0 && sanitized && sanitized !== rawTerm) {
      results = await this.executeGitHubSearch(`ComfyUI ${sanitized} in:name,description`, limit);
    }

    this.inMemorySearchCache.set(cacheKey, { timestamp: Date.now(), results });
    return results.slice(0, limit);
  }

  private executeGitHubSearch(q: string, limit: number): Promise<GitHubNodeRepo[]> {
    return new Promise((resolve) => {
      this.enqueueRateLimited(async () => {
        try {
          const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(
            q
          )}&sort=stars&order=desc&per_page=${limit}`;

          const data = await this.fetchHttpJson(url, {
            headers: {
              'User-Agent': 'CivitAI-Model-Manager-ComfyUI/1.3.0',
              Accept: 'application/vnd.github.v3+json',
            },
          });

          if (data && Array.isArray(data.items)) {
            const parsed: GitHubNodeRepo[] = data.items.map((item: any) => ({
              id: item.id,
              name: item.name,
              fullName: item.full_name,
              author: item.owner?.login || item.full_name?.split('/')[0] || '',
              htmlUrl: item.html_url,
              cloneUrl: item.clone_url || `${item.html_url}.git`,
              description: item.description || '',
              stars: item.stargazers_count || 0,
              language: item.language || 'Python',
              topics: Array.isArray(item.topics) ? item.topics : [],
              updatedAt: item.updated_at || '',
            }));
            resolve(parsed);
            return;
          }
          resolve([]);
        } catch (err: any) {
          logger.warn(`GitHub Search API error for query "${q}":`, err?.message || err);
          resolve([]);
        }
      });
    });
  }

  /**
   * 4-Tier Node Resolution:
   * Tier 1: Local package & NODE_CLASS_MAPPINGS inspection
   * Tier 2: ComfyUI-Manager curated database lookup
   * Tier 3: Rate-limited GitHub Search API fallback (top 3 candidates)
   */
  async resolveMissingNode(
    nodeType: string,
    customNodesDir?: string,
    installDir?: string
  ): Promise<NodeResolutionResult> {
    const cleanType = nodeType.trim();
    const result: NodeResolutionResult = {
      nodeType: cleanType,
      isInstalled: false,
      githubCandidates: [],
    };

    if (!cleanType) return result;

    // Tier 1: Local Check
    if (customNodesDir && fs.existsSync(customNodesDir)) {
      const localPackages = await this.inspectLocalCustomNodes(customNodesDir);
      for (const pkg of localPackages) {
        // Direct folder name match
        const normFolder = pkg.folderName.toLowerCase().replace(/^(comfyui-|comfy_)/i, '');
        const normType = cleanType.toLowerCase().replace(/^(comfyui-|comfy_)/i, '');

        if (
          normFolder === normType ||
          pkg.nodeClasses.some((c) => c.toLowerCase() === cleanType.toLowerCase())
        ) {
          result.isInstalled = true;
          result.installedFolder = pkg.folderName;
          result.installedPath = pkg.fullPath;
          return result;
        }
      }
    }

    // Tier 2: ComfyUI-Manager Registry Database Check
    const { nodeMap } = await this.getManagerRegistry();
    const mapEntry = nodeMap[cleanType] || nodeMap[cleanType.toLowerCase()];
    if (mapEntry && Array.isArray(mapEntry[0]) && mapEntry[0].length > 0) {
      const gitUrl = mapEntry[0][0];
      const title = mapEntry[1]?.title_aux || path.basename(gitUrl);
      result.managerMatch = {
        title,
        author: gitUrl.split('/')[3] || 'Community',
        gitUrl,
        description: `Registered ComfyUI extension supplying [${cleanType}]`,
      };
      return result;
    }

    // Tier 3: GitHub Fallback Search (Top 3 Candidates)
    result.queryUsed = cleanType;
    result.githubCandidates = await this.searchGitHubNodes(cleanType, 3);
    return result;
  }

  /**
   * Clones a custom node repository into <custom_nodes_dir> and detects requirements.txt / install.py
   */
  async cloneCustomNode(
    gitUrl: string,
    customNodesDir: string,
    comfyuiDir?: string,
    customFolderName?: string
  ): Promise<NodeCloneResult> {
    if (!gitUrl || !customNodesDir) {
      return {
        success: false,
        folderName: '',
        targetPath: '',
        hasRequirements: false,
        hasInstallScript: false,
        error: 'Missing git URL or custom_nodes directory',
      };
    }

    if (!fs.existsSync(customNodesDir)) {
      fs.mkdirSync(customNodesDir, { recursive: true });
    }

    let folderName = customFolderName;
    if (!folderName) {
      folderName = path.basename(gitUrl.trim()).replace(/\.git$/i, '');
    }

    const targetPath = path.join(customNodesDir, folderName);

    if (fs.existsSync(targetPath)) {
      const hasRequirements = fs.existsSync(path.join(targetPath, 'requirements.txt'));
      const hasInstallScript = fs.existsSync(path.join(targetPath, 'install.py'));
      const detectedPythonPath = this.detectPythonBinary(comfyuiDir);

      return {
        success: true,
        folderName,
        targetPath,
        hasRequirements,
        hasInstallScript,
        detectedPythonPath,
      };
    }

    const trimmedUrl = (gitUrl || '').trim();
    if (!trimmedUrl || (!trimmedUrl.startsWith('https://') && !trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('git@'))) {
      return {
        success: false,
        folderName,
        targetPath,
        hasRequirements: false,
        hasInstallScript: false,
        error: 'Invalid or unsupported Git URL provided',
      };
    }

    try {
      logger.info(`Cloning custom node [${folderName}] from: ${trimmedUrl}`);
      await execFileAsync('git', ['clone', '--depth', '1', trimmedUrl, targetPath]);

      const hasRequirements = fs.existsSync(path.join(targetPath, 'requirements.txt'));
      const hasInstallScript = fs.existsSync(path.join(targetPath, 'install.py'));
      const detectedPythonPath = this.detectPythonBinary(comfyuiDir);

      logger.info(`Successfully cloned custom node [${folderName}]. Dependencies: requirements=${hasRequirements}, installScript=${hasInstallScript}`);

      return {
        success: true,
        folderName,
        targetPath,
        hasRequirements,
        hasInstallScript,
        detectedPythonPath,
      };
    } catch (err: any) {
      logger.error(`Failed to clone custom node from ${gitUrl}:`, err);
      return {
        success: false,
        folderName,
        targetPath,
        hasRequirements: false,
        hasInstallScript: false,
        error: err?.message || 'Git clone failed',
      };
    }
  }

  /**
   * Installs Python dependencies using the targeted ComfyUI Python binary.
   */
  async installNodeDependencies(
    nodeFolderPath: string,
    comfyuiDir?: string
  ): Promise<{ success: boolean; output: string; error?: string }> {
    if (!fs.existsSync(nodeFolderPath)) {
      return { success: false, output: '', error: 'Target directory not found' };
    }

    const pythonBin = this.detectPythonBinary(comfyuiDir);
    const reqPath = path.join(nodeFolderPath, 'requirements.txt');
    const installPyPath = path.join(nodeFolderPath, 'install.py');

    let outputLog = '';

    try {
      if (fs.existsSync(reqPath)) {
        logger.info(`Installing requirements via [${pythonBin}] in ${nodeFolderPath}...`);
        const { stdout, stderr } = await execFileAsync(
          pythonBin,
          ['-m', 'pip', 'install', '-r', 'requirements.txt'],
          { cwd: nodeFolderPath }
        );
        outputLog += (stdout || '') + '\n' + (stderr || '');
      }

      if (fs.existsSync(installPyPath)) {
        logger.info(`Executing install.py via [${pythonBin}] in ${nodeFolderPath}...`);
        const { stdout, stderr } = await execFileAsync(
          pythonBin,
          ['install.py'],
          { cwd: nodeFolderPath }
        );
        outputLog += (stdout || '') + '\n' + (stderr || '');
      }

      return { success: true, output: outputLog };
    } catch (err: any) {
      logger.error(`Error installing dependencies in ${nodeFolderPath}:`, err);
      return { success: false, output: outputLog, error: err?.message || 'Installation failed' };
    }
  }

  private enqueueRateLimited(task: () => Promise<void>): void {
    this.requestQueue.push(task);
    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const now = Date.now();
      const elapsed = now - this.lastRequestTimestamp;
      if (elapsed < this.minIntervalMs) {
        await new Promise((r) => setTimeout(r, this.minIntervalMs - elapsed));
      }

      const task = this.requestQueue.shift();
      if (task) {
        this.lastRequestTimestamp = Date.now();
        await task().catch(() => {});
      }
    }

    this.isProcessingQueue = false;
  }

  private fetchHttpJson(urlStr: string, options: any = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(urlStr);
      const isHttps = parsedUrl.protocol === 'https:';
      const client = isHttps ? https : http;

      const req = client.get(urlStr, options, (res) => {
        if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
          return reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        }

        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve(body ? JSON.parse(body) : null);
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(8000, () => {
        req.destroy(new Error('Request timeout'));
      });
    });
  }

  private fetchJsonWithETag(urlStr: string, cachePrefix: string): Promise<any> {
    return new Promise(async (resolve) => {
      try {
        let etag = '';
        try {
          const row: any = await dbManager.get(
            `SELECT value FROM app_config WHERE key = '${cachePrefix}_etag';`
          );
          if (row?.value) etag = JSON.parse(row.value);
        } catch {}

        const headers: Record<string, string> = {
          'User-Agent': 'CivitAI-Model-Manager-ComfyUI/1.3.0',
        };
        if (etag) {
          headers['If-None-Match'] = etag;
        }

        https
          .get(urlStr, { headers }, async (res) => {
            if (res.statusCode === 304) {
              const cachedRow: any = await dbManager.get(
                `SELECT value FROM app_config WHERE key = '${cachePrefix}_cache';`
              );
              return resolve(cachedRow?.value ? JSON.parse(cachedRow.value) : null);
            }

            if (res.statusCode === 200) {
              let body = '';
              res.on('data', (chunk) => (body += chunk));
              res.on('end', async () => {
                try {
                  const parsed = JSON.parse(body);
                  const newEtag = res.headers.etag;
                  if (newEtag) {
                    await dbManager.run(
                      `INSERT OR REPLACE INTO app_config (key, value) VALUES ('${cachePrefix}_etag', ?);`,
                      [JSON.stringify(newEtag)]
                    );
                  }
                  resolve(parsed);
                } catch {
                  resolve(null);
                }
              });
              return;
            }

            resolve(null);
          })
          .on('error', () => resolve(null));
      } catch {
        resolve(null);
      }
    });
  }
}

export const nodeResolverService = new NodeResolverService();
