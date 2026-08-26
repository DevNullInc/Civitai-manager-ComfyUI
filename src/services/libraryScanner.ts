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
  private cancelRequested = false;
  private currentProgress: ScanProgress = {
    scannedFiles: 0,
    totalFiles: 0,
    status: 'idle',
  };

  cancelScan() {
    if (this.isScanning) {
      logger.info('Scan cancellation requested by user.');
      this.cancelRequested = true;
    }
  }

  isCurrentlyScanning(): boolean {
    return this.isScanning;
  }

  getScanStatus(): ScanProgress {
    return { ...this.currentProgress };
  }

  async scanDirectory(
    rootPath: string | string[],
    onProgress?: (progress: ScanProgress) => void
  ): Promise<LocalModel[]> {
    if (this.isScanning) {
      logger.warn('Scan already running. Returning current status.');
      return [];
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
    this.cancelRequested = false;
    logger.info(`Starting folder scan on directories: ${existingPaths.join(', ')}`);

    const emitProgress = (p: ScanProgress) => {
      this.currentProgress = { ...p };
      if (onProgress) {
        onProgress(this.currentProgress);
      }
    };

    emitProgress({
      scannedFiles: 0,
      totalFiles: 0,
      status: 'scanning',
      currentFile: 'Discovering model files...',
    });

    try {
      // 1. Collect all model files recursively across all existing root paths (avoiding symlink/junction duplicates)
      const allFiles: string[] = [];
      const seenRealPaths = new Set<string>();
      for (const p of existingPaths) {
        if (this.cancelRequested) break;
        allFiles.push(...this.collectModelFiles(p, seenRealPaths));
      }

      if (this.cancelRequested) {
        emitProgress({ scannedFiles: 0, totalFiles: 0, status: 'idle', currentFile: 'Scan cancelled.' });
        return [];
      }

      emitProgress({
        scannedFiles: 0,
        totalFiles: allFiles.length,
        status: 'hashing',
        currentFile: allFiles.length > 0 ? path.basename(allFiles[0]) : '',
      });

      const scannedModels: LocalModel[] = [];
      const hashesToLookup: { hash: string; localId: string }[] = [];

      // 2. Process each file with Fast-Path Cache Check
      for (let i = 0; i < allFiles.length; i++) {
        if (this.cancelRequested) {
          logger.info('Scan stopped during hashing phase.');
          emitProgress({
            scannedFiles: i,
            totalFiles: allFiles.length,
            status: 'idle',
            currentFile: 'Scan cancelled by user.',
          });
          return scannedModels;
        }

        const filePath = allFiles[i];
        emitProgress({
          scannedFiles: i + 1,
          totalFiles: allFiles.length,
          status: 'hashing',
          currentFile: path.basename(filePath),
        });

        // Yield to Node event loop so Electron IPC progress messages stream live to UI
        await new Promise((r) => setTimeout(r, 1));

        let stats: fs.Stats;
        try {
          stats = fs.statSync(filePath);
        } catch (e) {
          continue;
        }

        const modifiedAt = Math.floor(stats.mtimeMs);
        const fileSize = stats.size;

        // Check SQLite cache by filePath, fileSize, and modifiedAt (case-insensitive for Windows)
        const cached: any = await dbManager.get(
          'SELECT * FROM local_models WHERE file_path = ? COLLATE NOCASE',
          [filePath]
        );

        let sha256 = cached?.sha256;

        // Fast-path: if file size and modified timestamp match, skip SHA256 computation!
        if (!cached || cached.file_size !== fileSize || cached.modified_at !== modifiedAt || !sha256) {
          try {
            let lastByteReport = Date.now();
            sha256 = await computeFileSHA256(filePath, (bytesRead, totalBytes) => {
              const now = Date.now();
              if (now - lastByteReport > 200) {
                lastByteReport = now;
                const fileMb = (bytesRead / (1024 * 1024)).toFixed(0);
                const totalMb = (totalBytes / (1024 * 1024)).toFixed(0);
                emitProgress({
                  scannedFiles: i + 1,
                  totalFiles: allFiles.length,
                  status: 'hashing',
                  currentFile: `${path.basename(filePath)} (${fileMb}MB / ${totalMb}MB)`,
                });
              }
            });
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
      if (hashesToLookup.length > 0 && !this.cancelRequested) {
        emitProgress({
          scannedFiles: allFiles.length,
          totalFiles: allFiles.length,
          status: 'lookup',
          currentFile: `Querying CivitAI for ${hashesToLookup.length} model(s)...`,
        });

        const uniqueHashes = Array.from(new Set(hashesToLookup.map((h) => h.hash)));
        const civitaiVersions = await civitaiClient.bulkLookupByHashes(uniqueHashes, (done, total) => {
          emitProgress({
            scannedFiles: done,
            totalFiles: total,
            status: 'lookup',
            currentFile: `Checked ${done}/${total} hashes against CivitAI...`,
          });
        });

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
              const preview = matchedVersion.images && matchedVersion.images[0] ? matchedVersion.images[0].url : null;
              item.previewUrl = preview || undefined;
              item.modelType = undefined;

              await dbManager.run(
                'UPDATE local_models SET civitai_model_id = ?, civitai_version_id = ?, preview_url = ?, model_type = ? WHERE id = ?',
                [matchedVersion.modelId, matchedVersion.id, preview, null, item.id]
              );
            }
          }
        }
      }

      // 4. Purge stale / phantom records that are not in the current scan or missing from disk
      const scannedRealPaths = new Set(scannedModels.map((m) => m.filePath.toLowerCase()));
      const allDbRows: any[] = await dbManager.all('SELECT id, file_path FROM local_models');
      for (const row of allDbRows) {
        if (!scannedRealPaths.has(row.file_path.toLowerCase()) || !fs.existsSync(row.file_path)) {
          await dbManager.run('DELETE FROM local_models WHERE id = ?', [row.id]);
        }
      }

      // 5. Mark duplicates (only when same hash exists across distinct physical file paths)
      await this.flagDuplicates();

      emitProgress({
        scannedFiles: allFiles.length,
        totalFiles: allFiles.length,
        status: 'completed',
        currentFile: 'Scan completed successfully.',
      });
      logger.info(`Scan complete! Scanned ${scannedModels.length} models.`);
      return scannedModels;
    } catch (err: any) {
      emitProgress({
        scannedFiles: this.currentProgress.scannedFiles,
        totalFiles: this.currentProgress.totalFiles,
        status: 'failed',
        error: err.message,
      });
      logger.error('Library scan failed:', err);
      throw err;
    } finally {
      this.isScanning = false;
      this.cancelRequested = false;
    }
  }

  private collectModelFiles(dirPath: string, seenRealPaths: Set<string> = new Set()): string[] {
    const results: string[] = [];
    try {
      if (!fs.existsSync(dirPath)) return results;

      // Canonical realpath check to avoid traversing symlink/junction aliases multiple times
      let realDir: string;
      try {
        realDir = fs.realpathSync.native(dirPath);
      } catch (e) {
        realDir = path.resolve(dirPath);
      }

      const realDirKey = realDir.toLowerCase();
      if (seenRealPaths.has(realDirKey)) {
        return results;
      }
      seenRealPaths.add(realDirKey);

      const entries = fs.readdirSync(dirPath);

      for (const entryName of entries) {
        try {
          const fullPath = path.join(dirPath, entryName);
          const stat = fs.statSync(fullPath);

          if (stat.isDirectory()) {
            results.push(...this.collectModelFiles(fullPath, seenRealPaths));
          } else if (stat.isFile()) {
            const ext = path.extname(entryName).toLowerCase();
            if (MODEL_EXTENSIONS.has(ext)) {
              let realFile: string;
              try {
                realFile = fs.realpathSync.native(fullPath);
              } catch (e) {
                realFile = path.resolve(fullPath);
              }
              const realFileKey = realFile.toLowerCase();
              if (!seenRealPaths.has(realFileKey)) {
                seenRealPaths.add(realFileKey);
                results.push(realFile);
              }
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
        SELECT sha256 
        FROM local_models 
        WHERE sha256 IS NOT NULL AND TRIM(sha256) != ''
        GROUP BY sha256 
        HAVING COUNT(DISTINCT file_path COLLATE NOCASE) > 1
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
