/**
 * Renegade Core Model Manager (RenegadeCMM)
 * Copyright (C) 2025-2026 TheStygianRenegade / /dev/null Inc
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
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
  nsfw?: boolean | string;
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
  type?: ModelType;
  model?: {
    name?: string;
    type?: ModelType;
    nsfw?: boolean;
    poi?: boolean;
  };
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
    prevPage?: string;
    nextCursor?: string;
  };
}
