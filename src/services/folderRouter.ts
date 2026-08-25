import path from 'path';
import fs from 'fs';
import { ModelType, FileType } from '../types/civitai';
import { FolderConfig, FilenamePatternRule } from '../types/app';
import { sanitizeFileName } from '../utils/pathUtils';
import { logger } from '../utils/logger';

export const DEFAULT_FOLDER_MAP: Record<string, string> = {
  Checkpoint: 'checkpoints',
  LORA: 'loras',
  LoCon: 'loras',
  DoRA: 'loras',
  TextualInversion: 'embeddings',
  Hypernetwork: 'hypernetworks',
  VAE: 'vae',
  Controlnet: 'controlnet',
  Upscaler: 'upscale_models',
  MotionModule: 'model_patches',
  AestheticGradient: 'model_patches',
  Poses: 'workflows',
  Wildcards: 'wildcards',
  Workflows: 'workflows',
  Detection: 'detection',
  Other: 'checkpoints',
};

export const DEFAULT_FILENAME_PATTERNS: FilenamePatternRule[] = [
  { pattern: 'ip-adapter', folder: 'ipadapter', case_sensitive: false },
  { pattern: 'photomaker', folder: 'photomaker', case_sensitive: false },
  { pattern: 'pulid', folder: 'pulid', case_sensitive: false },
  { pattern: 'instantid', folder: 'insightface', case_sensitive: false },
  { pattern: 'reactor', folder: 'reactor', case_sensitive: false },
  { pattern: 'rmbg', folder: 'RMBG', case_sensitive: false },
  { pattern: 'sam\\d', folder: 'sam3', case_sensitive: false },
  { pattern: 'yolo', folder: 'yolo', case_sensitive: false },
  { pattern: 'ultralytics', folder: 'ultralytics', case_sensitive: false },
  { pattern: '\\.gguf$', folder: 'gguf', case_sensitive: false },
  { pattern: 'llm|qwen|llama', folder: 'LLM', case_sensitive: false },
  { pattern: 'unet', folder: 'unet', case_sensitive: false },
  { pattern: 'diffusion', folder: 'diffusion_models', case_sensitive: false },
  { pattern: 'esrgan|swinir|real-esrgan', folder: 'upscale_models', case_sensitive: false },
  { pattern: 'clip_vision', folder: 'clip_vision', case_sensitive: false },
  { pattern: 't5|clip.*encoder|text.*encoder', folder: 'text_encoders', case_sensitive: false },
];

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
