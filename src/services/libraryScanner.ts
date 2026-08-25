import fs from 'fs';
import path from 'path';
import chokidar, { FSWatcher } from 'chokidar';
import { LocalModel, ScanProgress } from '../types/app';
import { civitaiClient } from './civitaiClient';
import { dbManager } from '../db/db';
import { computeFileSHA256 } from '../utils/hash';
import { logger } from '../utils/logger';

const MODEL_EXTENSIONS = new Set(['.safetensors', '.ckpt', '.pt', '.bin', '.pth']);

export class LibraryScanner {
  private watcher: FSWatcher | null = null;
  private isScanning = false;

  async scanDirectory(
    rootPath: string,
    onProgress?: (progress: ScanProgress) => void
  ): Promise<LocalModel[]> {
    if (this.isScanning) {
      throw new Error('A scan is already in progress');
    }
    if (!rootPath || !fs.existsSync(rootPath)) {
      throw new Error(`Invalid root directory path: ${rootPath}`);
    }

    this.isScanning = true;
    logger.info(`Starting folder scan on root directory: ${rootPath}`);

    const progress: ScanProgress = {
      scannedFiles: 0,
      totalFiles: 0,
      status: 'scanning',
    };

    if (onProgress) onProgress({ ...progress });

    try {
      // 1. Collect all model files recursively
      const allFiles = this.collectModelFiles(rootPath);
      progress.totalFiles = allFiles.length;
      if (onProgress) onProgress({ ...progress });

      const scannedModels: LocalModel[] = [];
      const hashesToLookup: { hash: string; localId: string }[] = [];

      // 2. Process each file with Fast-Path Cache Check
      progress.status = 'hashing';
      for (const filePath of allFiles) {
        progress.currentFile = path.basename(filePath);
        if (onProgress) onProgress({ ...progress });

        const stats = fs.statSync(filePath);
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
        };

        scannedModels.push(localModel);

        // Save/Update in SQLite
        await dbManager.run(
          `INSERT OR REPLACE INTO local_models 
            (id, file_path, file_name, file_size, modified_at, sha256, civitai_model_id, civitai_version_id, scanned_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          [
            localModel.id,
            localModel.filePath,
            localModel.fileName,
            localModel.fileSize,
            localModel.modifiedAt,
            localModel.sha256,
            localModel.civitaiModelId || null,
            localModel.civitaiVersionId || null,
          ]
        );

        if (!localModel.isMatched && sha256) {
          hashesToLookup.push({ hash: sha256, localId });
        }

        progress.scannedFiles++;
        if (onProgress) onProgress({ ...progress });
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

              await dbManager.run(
                'UPDATE local_models SET civitai_model_id = ?, civitai_version_id = ? WHERE id = ?',
                [matchedVersion.modelId, matchedVersion.id, item.id]
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
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        results.push(...this.collectModelFiles(fullPath));
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (MODEL_EXTENSIONS.has(ext)) {
          results.push(fullPath);
        }
      }
    }

    return results;
  }

  private async flagDuplicates() {
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
