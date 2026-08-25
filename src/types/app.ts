import { ModelType } from './civitai';

export type ConflictStrategy = 'skip' | 'replace' | 'rename' | 'prompt';

export interface FilenamePatternRule {
  pattern: string;
  folder: string;
  case_sensitive?: boolean;
}

export interface FolderConfig {
  rootPath: string;
  folderMappings: Record<string, string>;
  separateByBaseModel: boolean;
  separateByCreator: boolean;
  advancedMappings: {
    filename_patterns: FilenamePatternRule[];
  };
}

export interface AppConfig {
  comfyui_root: string;
  civitai_api_key?: string;
  mirror_url?: string; // e.g. https://civitai.red
  folder_mappings: Record<string, string>;
  advanced_mappings: {
    filename_patterns: FilenamePatternRule[];
  };
  organize_by: {
    base_model: boolean;
    creator: boolean;
  };
  conflict_strategy: ConflictStrategy;
  nsfw_max_visible_level: number; // 1-31 scale (e.g. 5 = suggestive visible, mature/explicit blurred)
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
  progress: number; // 0 - 100
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
