/**
 * CivitAI Model Manager - ComfyUI Edition
 * Copyright (C) 2025-2026 TheStygianRenegade / /dev/null Inc
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import path from 'path';
import fs from 'fs';
import { ModelType, FileType } from '../types/civitai';
import { FolderConfig, FilenamePatternRule, DEFAULT_FOLDER_MAP, DEFAULT_FILENAME_PATTERNS } from '../types/app';
import { sanitizeFileName } from '../utils/pathUtils';
import { logger } from '../utils/logger';

export class FolderRouter {
  private config: FolderConfig;

  constructor(config?: Partial<FolderConfig>) {
    this.config = {
      rootPath: config?.rootPath || '',
      folderMappings: { ...DEFAULT_FOLDER_MAP, ...(config?.folderMappings || {}) },
      separateByBaseModel: config?.separateByBaseModel ?? false,
      separateByCreator: config?.separateByCreator ?? false,
      advancedMappings: {
        filename_patterns:
          config?.advancedMappings?.filename_patterns || DEFAULT_FILENAME_PATTERNS,
      },
    };
  }

  updateConfig(newConfig: Partial<FolderConfig>) {
    this.config = {
      ...this.config,
      ...newConfig,
      folderMappings: {
        ...this.config.folderMappings,
        ...(newConfig.folderMappings || {}),
      },
      advancedMappings: {
        filename_patterns:
          newConfig.advancedMappings?.filename_patterns ||
          this.config.advancedMappings.filename_patterns,
      },
    };
  }

  determineFolder(
    fileName: string,
    modelType: ModelType,
    fileType?: FileType
  ): string {
    // 1. Check secondary file type overrides
    if (fileType === 'VAE') return 'vae';
    if (fileType === 'Text Encoder') return 'text_encoders';
    if (fileType === 'Config') return 'configs';

    // 2. Check filename pattern rules
    for (const rule of this.config.advancedMappings.filename_patterns) {
      try {
        const flags = rule.case_sensitive === false ? 'i' : '';
        const regex = new RegExp(rule.pattern, flags);
        if (regex.test(fileName)) {
          return rule.folder;
        }
      } catch (err) {
        logger.warn(`Invalid regex pattern rule: ${rule.pattern}`, err);
      }
    }

    // 3. Fallback to modelType folder mapping
    return this.config.folderMappings[modelType] || 'checkpoints';
  }

  computePath(params: {
    fileName: string;
    modelType: ModelType;
    baseModel?: string;
    creator?: string;
    fileType?: FileType;
  }): { folderName: string; fullPath: string; relativePath: string } {
    const { fileName, modelType, baseModel, creator, fileType } = params;

    const baseFolder = this.determineFolder(fileName, modelType, fileType);
    const sanitizedFileName = sanitizeFileName(fileName);

    const pathParts: string[] = [baseFolder];

    if (this.config.separateByBaseModel && baseModel) {
      pathParts.push(sanitizeFileName(baseModel));
    }

    if (this.config.separateByCreator && creator) {
      pathParts.push(sanitizeFileName(creator));
    }

    const relativePath = path.join(...pathParts, sanitizedFileName);
    const fullPath = this.config.rootPath
      ? path.join(this.config.rootPath, relativePath)
      : relativePath;

    return {
      folderName: baseFolder,
      fullPath,
      relativePath,
    };
  }

  ensureTargetDirectory(targetPath: string): void {
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.info(`Created destination folder: ${dir}`);
    }
  }
}

export const folderRouter = new FolderRouter();
