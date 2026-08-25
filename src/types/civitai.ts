export type ModelType =
  | 'Checkpoint'
  | 'LORA'
  | 'LoCon'
  | 'DoRA'
  | 'TextualInversion'
  | 'Hypernetwork'
  | 'VAE'
  | 'Controlnet'
  | 'Upscaler'
  | 'MotionModule'
  | 'AestheticGradient'
  | 'Poses'
  | 'Wildcards'
  | 'Workflows'
  | 'Detection'
  | 'Other';

export type FileType =
  | 'Model'
  | 'VAE'
  | 'Text Encoder'
  | 'Config'
  | 'Training Data'
  | 'Archive';

export interface CivitAIHashes {
  SHA256?: string;
  AutoV1?: string;
  AutoV2?: string;
  AutoV3?: string;
  BLAKE3?: string;
  CRC32?: string;
  [key: string]: string | undefined;
}

export interface CivitAIFile {
  id: number;
  name: string;
  sizeKB: number;
  type: FileType;
  primary?: boolean;
  downloadUrl: string;
  hashes?: CivitAIHashes;
  metadata?: {
    format?: string;
    fp?: string;
    size?: string;
  };
}

export interface CivitAIImage {
  id?: number;
  url: string;
  nsfwLevel?: number; // 1-31 scale
  width?: number;
  height?: number;
  hash?: string;
  meta?: Record<string, any>;
}

export interface CivitAIModelVersion {
  id: number;
  modelId: number;
  name: string;
  description?: string;
  baseModel: string;
  createdAt?: string;
  publishedAt?: string;
  downloadUrl: string;
  files: CivitAIFile[];
  images?: CivitAIImage[];
}

export interface CivitAICreator {
  username: string;
  image?: string;
}

export interface CivitAIStats {
  downloadCount: number;
  ratingCount?: number;
  rating?: number;
  favoriteCount?: number;
  thumbsUpCount?: number;
}

export interface CivitAIModel {
  id: number;
  name: string;
  description?: string;
  type: ModelType;
  nsfw: boolean;
  nsfwLevel?: number; // 1-31 scale
  tags?: string[];
  creator?: CivitAICreator;
  stats?: CivitAIStats;
  modelVersions: CivitAIModelVersion[];
}

export interface SearchParams {
  query?: string;
  types?: ModelType[];
  baseModels?: string[];
  nsfw?: boolean;
  sort?: 'Highest Rated' | 'Most Downloaded' | 'Newest' | 'Most Liked';
  period?: 'AllTime' | 'Year' | 'Month' | 'Week' | 'Day';
  limit?: number;
  page?: number;
  cursor?: string;
  tag?: string;
  username?: string;
}

export interface ModelListResponse {
  items: CivitAIModel[];
  metadata?: {
    totalItems?: number;
    currentPage?: number;
    pageSize?: number;
    totalPages?: number;
    nextPage?: string;
  };
}
