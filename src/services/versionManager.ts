import { LocalModel } from '../types/app';
import { CivitAIModelVersion } from '../types/civitai';
import { civitaiClient } from './civitaiClient';
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

      return {
        currentVersionId: localModel.civitaiVersionId,
        latestVersionId: latestVersion.id,
        latestVersionName: latestVersion.name,
        hasUpdate,
        publishedAt: latestVersion.publishedAt,
        downloadUrl: civitaiClient.getDownloadUrl(latestVersion.id),
        changelog: latestVersion.description,
      };
    } catch (err) {
      logger.error(`Error checking update for model ID ${localModel.civitaiModelId}:`, err);
      return null;
    }
  }

  async getVersionHistory(modelId: number): Promise<CivitAIModelVersion[]> {
    const fullModel = await civitaiClient.fetchModel(modelId);
    return fullModel.modelVersions || [];
  }
}

export const versionManager = new VersionManager();
