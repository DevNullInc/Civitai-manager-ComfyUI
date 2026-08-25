import type { ModelType } from './civitai';
export type { ModelType } from './civitai';

export type ConflictStrategy = 'skip' | 'replace' | 'rename' | 'prompt';

export interface FilenamePatternRule {
  pattern: string;
  folder: string;
  case_sensitive?: boolean;
}

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

export interface FolderConfig {
  rootPath: string;
  folderPaths?: string[];
  folderMappings: Record<string, string>;
  separateByBaseModel: boolean;
  separateByCreator: boolean;
  advancedMappings: {
    filename_patterns: FilenamePatternRule[];
  };
}

export interface AppConfig {
  comfyui_root: string;
  comfyui_folders: string[]; // Multi-folder list support
  civitai_api_key?: string;
  mirror_url?: string;
  folder_mappings: Record<string, string>;
  advanced_mappings: {
    filename_patterns: FilenamePatternRule[];
  };
  organize_by: {
    base_model: boolean;
    creator: boolean;
  };
  conflict_strategy: ConflictStrategy;
  nsfw_max_visible_level: number;
  nsfw_blur_enabled: boolean;
}

export interface DownloadTask {
  id: string;
  modelVersionId: number;
  modelId: number;
  modelName: string;
  versionName: string;
  modelType: ModelType;
  baseModel: string;
  targetFolder: string;
  fileName: string;
  downloadUrl: string;
  sizeKB: number;
  sha256?: string;
  status: 'pending' | 'downloading' | 'verifying' | 'completed' | 'failed' | 'paused';
  progress: number;
  downloadedBytes: number;
  totalBytes: number;
  speedBps: number;
  error?: string;
  computedPath: string;
  requiresAuth?: boolean;
}

export interface LocalModel {
  id: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  modifiedAt: number;
  sha256?: string;
  civitaiModelId?: number;
  civitaiVersionId?: number;
  civitaiName?: string;
  civitaiType?: ModelType;
  civitaiBaseModel?: string;
  civitaiCreator?: string;
  previewUrl?: string;
  modelType?: ModelType;
  isMatched: boolean;
  hasUpdate?: boolean;
  updateVersionId?: number;
  updateVersionName?: string;
  isDuplicate?: boolean;
}

export interface ScanProgress {
  scannedFiles: number;
  totalFiles: number;
  currentFile?: string;
  status: 'idle' | 'scanning' | 'hashing' | 'lookup' | 'completed' | 'failed';
  error?: string;
}
