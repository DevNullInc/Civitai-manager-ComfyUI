/**
 * CivitAI Model Manager - ComfyUI Edition
 * Copyright (C) 2025-2026 TheStygianRenegade / /dev/null Inc
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import { LocalModel } from '../types/app';
import { CivitAIModelVersion } from '../types/civitai';
import { civitaiClient } from './civitaiClient';
import { dbManager } from '../db/db';
import { logger } from '../utils/logger';

export interface UpdateInfo {
  currentVersionId: number;
  latestVersionId: number;
  latestVersionName: string;
  hasUpdate: boolean;
  publishedAt?: string;
  downloadUrl?: string;
  changelog?: string;
}

export interface BatchUpdateProgress {
  scanned: number;
  total: number;
  updatesFound: number;
  currentModel?: string;
}

export interface BatchUpdateResult {
  totalChecked: number;
  updatesFound: number;
  modelsWithUpdates: Array<{
    id: string;
    filePath: string;
    fileName: string;
    civitaiModelId: number;
    currentVersionId: number;
    latestVersionId: number;
    latestVersionName: string;
    downloadUrl?: string;
  }>;
}

export class VersionManager {
  async checkForUpdates(localModel: LocalModel): Promise<UpdateInfo | null> {
    if (!localModel.civitaiModelId || !localModel.civitaiVersionId) {
      return null;
    }

    try {
      const fullModel = await civitaiClient.fetchModel(localModel.civitaiModelId);
      if (!fullModel || !fullModel.modelVersions || fullModel.modelVersions.length === 0) {
        return null;
      }

      const latestVersion = fullModel.modelVersions[0];
      const hasUpdate = latestVersion.id !== localModel.civitaiVersionId;
      const downloadUrl = civitaiClient.getDownloadUrl(latestVersion.id);

      // Persist update status to database
      if (hasUpdate) {
        await dbManager.run(
          `UPDATE local_models SET has_update = 1, update_version_id = ?, update_version_name = ?, update_download_url = ? WHERE id = ?;`,
          [latestVersion.id, latestVersion.name, downloadUrl, localModel.id]
        );
      } else {
        await dbManager.run(
          `UPDATE local_models SET has_update = 0, update_version_id = NULL, update_version_name = NULL, update_download_url = NULL WHERE id = ?;`,
          [localModel.id]
        );
      }

      return {
        currentVersionId: localModel.civitaiVersionId,
        latestVersionId: latestVersion.id,
        latestVersionName: latestVersion.name,
        hasUpdate,
        publishedAt: latestVersion.publishedAt,
        downloadUrl,
        changelog: latestVersion.description,
      };
    } catch (err) {
      logger.error(`Error checking update for model ID ${localModel.civitaiModelId}:`, err);
      return null;
    }
  }

  async batchCheckAllUpdates(
    onProgress?: (progress: BatchUpdateProgress) => void
  ): Promise<BatchUpdateResult> {
    logger.info('Starting batch check for model updates...');
    const localRows = await dbManager.all(
      'SELECT * FROM local_models WHERE civitai_model_id IS NOT NULL AND civitai_version_id IS NOT NULL;'
    );

    const total = localRows.length;
    if (total === 0) {
      return { totalChecked: 0, updatesFound: 0, modelsWithUpdates: [] };
    }

    // Cache model details to prevent repetitive API calls for models with multiple local files
    const modelCache = new Map<number, any>();
    const modelsWithUpdates: BatchUpdateResult['modelsWithUpdates'] = [];
    let scanned = 0;
    let updatesFound = 0;

    for (const row of localRows) {
      scanned++;
      const modelId = row.civitai_model_id;
      const currentVersionId = row.civitai_version_id;

      if (onProgress) {
        onProgress({
          scanned,
          total,
          updatesFound,
          currentModel: row.file_name,
        });
      }

      try {
        let fullModel = modelCache.get(modelId);
        if (!fullModel) {
          fullModel = await civitaiClient.fetchModel(modelId);
          if (fullModel) {
            modelCache.set(modelId, fullModel);
          }
        }

        if (fullModel && fullModel.modelVersions && fullModel.modelVersions.length > 0) {
          const latestVersion = fullModel.modelVersions[0];
          if (latestVersion.id !== currentVersionId) {
            updatesFound++;
            const downloadUrl = civitaiClient.getDownloadUrl(latestVersion.id);

            await dbManager.run(
              `UPDATE local_models SET has_update = 1, update_version_id = ?, update_version_name = ?, update_download_url = ? WHERE id = ?;`,
              [latestVersion.id, latestVersion.name, downloadUrl, row.id]
            );

            modelsWithUpdates.push({
              id: row.id,
              filePath: row.file_path,
              fileName: row.file_name,
              civitaiModelId: modelId,
              currentVersionId,
              latestVersionId: latestVersion.id,
              latestVersionName: latestVersion.name,
              downloadUrl,
            });
          } else {
            await dbManager.run(
              `UPDATE local_models SET has_update = 0, update_version_id = NULL, update_version_name = NULL, update_download_url = NULL WHERE id = ?;`,
              [row.id]
            );
          }
        }
      } catch (e) {
        logger.warn(`Failed to check update for model ${row.file_name} (ID: ${modelId}):`, e);
      }
    }

    logger.info(`Batch update check finished. Checked ${total} models, found ${updatesFound} update(s).`);
    return {
      totalChecked: total,
      updatesFound,
      modelsWithUpdates,
    };
  }

  async getVersionHistory(modelId: number): Promise<CivitAIModelVersion[]> {
    const fullModel = await civitaiClient.fetchModel(modelId);
    return fullModel.modelVersions || [];
  }
}

export const versionManager = new VersionManager();
