import fs from 'fs';
import path from 'path';
import chokidar, { FSWatcher } from 'chokidar';
import { LocalModel, ScanProgress } from '../types/app';
import { civitaiClient } from './civitaiClient';
import { dbManager } from '../db/db';
import { computeFileSHA256 } from '../utils/hash';
import { logger } from '../utils/logger';

const MODEL_EXTENSIONS = new Set([
  '.safetensors',
  '.ckpt',
  '.pt',
  '.bin',
  '.pth',
  '.gguf',
  '.sft',
  '.onnx',
  '.engine',
  '.tensor',
]);

export class LibraryScanner {
  private watcher: FSWatcher | null = null;
  private isScanning = false;

  async scanDirectory(
    rootPath: string | string[],
    onProgress?: (progress: ScanProgress) => void
  ): Promise<LocalModel[]> {
    if (this.isScanning) {
      throw new Error('A scan is already in progress');
    }
    const rootPaths = Array.isArray(rootPath) ? rootPath.filter(Boolean) : [rootPath].filter(Boolean);
    if (rootPaths.length === 0) {
      throw new Error('No folder paths provided for scanning. Please add model folders in Settings.');
    }

    const existingPaths = rootPaths.filter((p) => fs.existsSync(p));
    const missingPaths = rootPaths.filter((p) => !fs.existsSync(p));

    if (missingPaths.length > 0) {
      logger.warn(`The following configured model folders do not exist on disk: ${missingPaths.join(', ')}`);
    }

    if (existingPaths.length === 0) {
      throw new Error(
        `None of your configured model folders exist on disk (${missingPaths.join(', ')}). Please verify your folder paths in Settings.`
      );
    }

    this.isScanning = true;
    logger.info(`Starting folder scan on directories: ${existingPaths.join(', ')}`);

    const progress: ScanProgress = {
      scannedFiles: 0,
      totalFiles: 0,
      status: 'scanning',
    };

    if (onProgress) onProgress({ ...progress });

    try {
      // 1. Collect all model files recursively across all existing root paths
      const allFiles: string[] = [];
      for (const p of existingPaths) {
        allFiles.push(...this.collectModelFiles(p));
      }

      progress.totalFiles = allFiles.length;
      if (onProgress) onProgress({ ...progress });

      const scannedModels: LocalModel[] = [];
      const hashesToLookup: { hash: string; localId: string }[] = [];

      // 2. Process each file with Fast-Path Cache Check
      progress.status = 'hashing';
      for (let i = 0; i < allFiles.length; i++) {
        const filePath = allFiles[i];
        progress.scannedFiles = i + 1;
        progress.currentFile = path.basename(filePath);
        if (onProgress) onProgress({ ...progress });

        // Yield to Node event loop so Electron IPC progress messages stream live to UI
        await new Promise((r) => setTimeout(r, 2));

        let stats: fs.Stats;
        try {
          stats = fs.statSync(filePath);
        } catch (e) {
          continue;
        }

        const modifiedAt = Math.floor(stats.mtimeMs);
        const fileSize = stats.size;

        // Check SQLite cache by filePath, fileSize, and modifiedAt
        const cached: any = await dbManager.get(
          'SELECT * FROM local_models WHERE file_path = ?',
          [filePath]
        );

        let sha256 = cached?.sha256;

        // Fast-path: if file size and modified timestamp match, skip SHA256 computation!
        if (!cached || cached.file_size !== fileSize || cached.modified_at !== modifiedAt || !sha256) {
          try {
            sha256 = await computeFileSHA256(filePath);
          } catch (hashErr) {
            logger.error(`Error hashing file ${filePath}:`, hashErr);
            continue;
          }
        }

        const localId = cached?.id || `loc_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

        const localModel: LocalModel = {
          id: localId,
          filePath,
          fileName: path.basename(filePath),
          fileSize,
          modifiedAt,
          sha256,
          civitaiModelId: cached?.civitai_model_id,
          civitaiVersionId: cached?.civitai_version_id,
          isMatched: !!cached?.civitai_version_id,
          previewUrl: cached?.preview_url || undefined,
          modelType: cached?.model_type || undefined,
        };

        scannedModels.push(localModel);

        // Save/Update in SQLite
        await dbManager.run(
          `INSERT OR REPLACE INTO local_models 
            (id, file_path, file_name, file_size, modified_at, sha256, civitai_model_id, civitai_version_id, scanned_at, preview_url, model_type)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)`,
          [
            localModel.id,
            localModel.filePath,
            localModel.fileName,
            localModel.fileSize,
            localModel.modifiedAt,
            localModel.sha256,
            localModel.civitaiModelId || null,
            localModel.civitaiVersionId || null,
            localModel.previewUrl || null,
            localModel.modelType || null,
          ]
        );

        if (!localModel.isMatched && sha256) {
          hashesToLookup.push({ hash: sha256, localId });
        }
      }

      // 3. Perform Bulk CivitAI Hash Lookup for unmatched models
      if (hashesToLookup.length > 0) {
        progress.status = 'lookup';
        if (onProgress) onProgress({ ...progress });

        const uniqueHashes = Array.from(new Set(hashesToLookup.map((h) => h.hash)));
        const civitaiVersions = await civitaiClient.bulkLookupByHashes(uniqueHashes);

        const versionMap = new Map<string, any>();
        civitaiVersions.forEach((v) => {
          if (v && v.files) {
            v.files.forEach((f) => {
              if (f.hashes) {
                Object.values(f.hashes).forEach((h) => {
                  if (h) versionMap.set(h.toUpperCase(), v);
                });
              }
            });
          }
        });

        // Update local models with matched CivitAI info
        for (const item of scannedModels) {
          if (!item.isMatched && item.sha256) {
            const matchedVersion = versionMap.get(item.sha256.toUpperCase());
            if (matchedVersion) {
              item.isMatched = true;
              item.civitaiVersionId = matchedVersion.id;
              item.civitaiModelId = matchedVersion.modelId;
              item.civitaiName = matchedVersion.name;
              item.civitaiBaseModel = matchedVersion.baseModel;
              // Store preview image URL if available
              const preview = matchedVersion.images && matchedVersion.images[0] ? matchedVersion.images[0].url : null;
              item.previewUrl = preview || undefined;
              // Model type is not directly in version; we could fetch model later. For now set null.
              item.modelType = undefined;

              await dbManager.run(
                'UPDATE local_models SET civitai_model_id = ?, civitai_version_id = ?, preview_url = ?, model_type = ? WHERE id = ?',
                [matchedVersion.modelId, matchedVersion.id, preview, null, item.id]
              );
            }
          }
        }
      }

      // 4. Mark duplicates (same hash across different file paths)
      await this.flagDuplicates();

      progress.status = 'completed';
      if (onProgress) onProgress({ ...progress });
      logger.info(`Scan complete! Scanned ${scannedModels.length} models.`);
      return scannedModels;
    } catch (err: any) {
      progress.status = 'failed';
      progress.error = err.message;
      if (onProgress) onProgress({ ...progress });
      logger.error('Library scan failed:', err);
      throw err;
    } finally {
      this.isScanning = false;
    }
  }

  private collectModelFiles(dirPath: string): string[] {
    const results: string[] = [];
    try {
      if (!fs.existsSync(dirPath)) return results;
      const entries = fs.readdirSync(dirPath);

      for (const entryName of entries) {
        try {
          const fullPath = path.join(dirPath, entryName);
          // fs.statSync follows symlinks & junctions!
          const stat = fs.statSync(fullPath);

          if (stat.isDirectory()) {
            results.push(...this.collectModelFiles(fullPath));
          } else if (stat.isFile()) {
            const ext = path.extname(entryName).toLowerCase();
            if (MODEL_EXTENSIONS.has(ext)) {
              results.push(fullPath);
            }
          }
        } catch (itemErr) {
          // Skip inaccessible or locked files
        }
      }
    } catch (dirErr) {
      logger.warn(`Could not read directory ${dirPath}:`, dirErr);
    }

    return results;
  }

  async flagDuplicates() {
    await dbManager.run('UPDATE local_models SET is_duplicate = 0;');
    await dbManager.run(`
      UPDATE local_models 
      SET is_duplicate = 1 
      WHERE sha256 IN (
        SELECT sha256 FROM local_models WHERE sha256 IS NOT NULL GROUP BY sha256 HAVING COUNT(*) > 1
      );
    `);
  }

  startLiveWatcher(rootPath: string, onChange?: (event: string, filePath: string) => void) {
    this.stopLiveWatcher();
    if (!rootPath || !fs.existsSync(rootPath)) return;

    logger.info(`Starting chokidar live filesystem watcher on: ${rootPath}`);
    this.watcher = chokidar.watch(rootPath, {
      ignored: /(^|[\/\\])\..|.*\.part$/,
      persistent: true,
      ignoreInitial: true,
      depth: 6,
    });

    this.watcher.on('add', (filePath) => {
      if (MODEL_EXTENSIONS.has(path.extname(filePath).toLowerCase())) {
        logger.info(`File added: ${filePath}`);
        if (onChange) onChange('add', filePath);
      }
    });

    this.watcher.on('unlink', async (filePath) => {
      logger.info(`File deleted: ${filePath}`);
      await dbManager.run('DELETE FROM local_models WHERE file_path = ?', [filePath]);
      if (onChange) onChange('unlink', filePath);
    });
  }

  stopLiveWatcher() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }
}

export const libraryScanner = new LibraryScanner();
