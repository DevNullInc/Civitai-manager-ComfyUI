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
import { dbManager } from '../db/db';
import { logger } from '../utils/logger';

export interface BackupData {
  version: string;
  timestamp: string;
  config: any[];
  localModels: any[];
  downloads: any[];
}

export class BackupService {
  async exportBackup(destinationPath: string): Promise<void> {
    try {
      const config = await dbManager.all('SELECT * FROM app_config;');
      const localModels = await dbManager.all('SELECT * FROM local_models;');
      const downloads = await dbManager.all('SELECT * FROM downloads;');

      const backup: BackupData = {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        config,
        localModels,
        downloads,
      };

      fs.writeFileSync(destinationPath, JSON.stringify(backup, null, 2), 'utf8');
      logger.info(`Backup successfully exported to: ${destinationPath}`);
    } catch (err) {
      logger.error('Failed to export backup:', err);
      throw err;
    }
  }

  async importBackup(sourcePath: string): Promise<void> {
    try {
      const content = fs.readFileSync(sourcePath, 'utf8');
      const backup: BackupData = JSON.parse(content);

      if (!backup.localModels || !Array.isArray(backup.localModels)) {
        throw new Error('Invalid backup file format');
      }

      await dbManager.exec('BEGIN TRANSACTION;');

      if (backup.config && Array.isArray(backup.config)) {
        for (const cfg of backup.config) {
          await dbManager.run(
            'INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?);',
            [cfg.key, cfg.value]
          );
        }
      }

      for (const lm of backup.localModels) {
        await dbManager.run(
          `INSERT OR REPLACE INTO local_models 
            (id, file_path, file_name, file_size, modified_at, sha256, civitai_model_id, civitai_version_id, scanned_at, is_duplicate)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            lm.id,
            lm.file_path,
            lm.file_name,
            lm.file_size,
            lm.modified_at,
            lm.sha256,
            lm.civitai_model_id,
            lm.civitai_version_id,
            lm.scanned_at,
            lm.is_duplicate || 0,
          ]
        );
      }

      await dbManager.exec('COMMIT;');
      logger.info(`Backup successfully imported from: ${sourcePath}`);
    } catch (err) {
      await dbManager.exec('ROLLBACK;').catch(() => {});
      logger.error('Failed to import backup:', err);
      throw err;
    }
  }
}

export const backupService = new BackupService();
