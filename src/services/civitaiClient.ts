import axios, { AxiosInstance } from 'axios';
import {
  CivitAIModel,
  CivitAIModelVersion,
  ModelListResponse,
  ModelType,
  SearchParams,
} from '../types/civitai';
import { RateLimiter } from '../utils/rateLimiter';
import { logger } from '../utils/logger';

export class CivitAIClient {
  private baseUrl: string = 'https://civitai.com/api/v1';
  private apiKey?: string;
  private rateLimiter: RateLimiter;
  private axiosInstance: AxiosInstance;

  constructor(apiKey?: string, baseUrl = 'https://civitai.com/api/v1') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.rateLimiter = new RateLimiter(apiKey ? 20 : 10);
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: 15000,
    });
  }

  setApiKey(key?: string) {
    this.apiKey = key;
    this.rateLimiter.setRateLimit(key ? 20 : 10);
  }

  setBaseUrl(url: string) {
    this.baseUrl = url;
    this.axiosInstance.defaults.baseURL = url;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'CivitAI-Model-Manager-ComfyUI/1.0',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  async validateApiKey(): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      await this.rateLimiter.executeWithRetry(() =>
        this.axiosInstance.get('/models', {
          params: { limit: 1 },
          headers: this.getHeaders(),
        })
      );
      return true;
    } catch (err) {
      logger.error('API key validation failed:', err);
      return false;
    }
  }

  async fetchModels(params: SearchParams = {}): Promise<ModelListResponse> {
    return this.rateLimiter.executeWithRetry(async () => {
      const queryParams: Record<string, any> = { ...params };
      if (params.types && params.types.length > 0) {
        queryParams.types = params.types.join(',');
      }
      if (params.baseModels && params.baseModels.length > 0) {
        queryParams.baseModels = params.baseModels.join(',');
      }

      const res = await this.axiosInstance.get('/models', {
        params: queryParams,
        headers: this.getHeaders(),
      });

      return {
        items: res.data.items || res.data || [],
        metadata: res.data.metadata || {},
      };
    });
  }

  async fetchModel(id: number): Promise<CivitAIModel> {
    return this.rateLimiter.executeWithRetry(async () => {
      const res = await this.axiosInstance.get(`/models/${id}`, {
        headers: this.getHeaders(),
      });
      return res.data;
    });
  }

  async fetchModelVersion(id: number): Promise<CivitAIModelVersion> {
    return this.rateLimiter.executeWithRetry(async () => {
      const res = await this.axiosInstance.get(`/model-versions/${id}`, {
        headers: this.getHeaders(),
      });
      return res.data;
    });
  }

  async fetchModelVersionMini(id: number): Promise<Partial<CivitAIModelVersion>> {
    return this.rateLimiter.executeWithRetry(async () => {
      const res = await this.axiosInstance.get(`/model-versions/mini/${id}`, {
        headers: this.getHeaders(),
      });
      return res.data;
    });
  }

  async lookupByHash(hash: string): Promise<CivitAIModelVersion | null> {
    return this.rateLimiter.executeWithRetry(async () => {
      try {
        const res = await this.axiosInstance.get(`/model-versions/by-hash/${hash}`, {
          headers: this.getHeaders(),
        });
        return res.data;
      } catch (err: any) {
        if (err?.response?.status === 404) return null;
        throw err;
      }
    });
  }

  async bulkLookupByHashes(hashes: string[]): Promise<CivitAIModelVersion[]> {
    if (hashes.length === 0) return [];

    // CivitAI limits bulk lookup to max 100 hashes per request
    const BATCH_SIZE = 100;
    const results: CivitAIModelVersion[] = [];

    for (let i = 0; i < hashes.length; i += BATCH_SIZE) {
      const chunk = hashes.slice(i, i + BATCH_SIZE);
      await this.rateLimiter.executeWithRetry(async () => {
        try {
          const res = await this.axiosInstance.post('/model-versions/by-hash', chunk, {
            headers: this.getHeaders(),
          });
          const returned = res.data;
          if (Array.isArray(returned)) {
            results.push(...returned);
          } else if (returned && typeof returned === 'object') {
            Object.values(returned).forEach((item: any) => {
              if (item) results.push(item);
            });
          }
        } catch (err) {
          logger.error(`Error in bulk lookup batch starting at index ${i}:`, err);
        }
      });
    }

    return results;
  }

  async fetchEnums(): Promise<{ modelTypes: ModelType[]; baseModels: string[] }> {
    return this.rateLimiter.executeWithRetry(async () => {
      try {
        const res = await this.axiosInstance.get('/enums', {
          headers: this.getHeaders(),
        });
        return {
          modelTypes: res.data.modelType || res.data.ModelType || [],
          baseModels: res.data.baseModel || res.data.BaseModel || [],
        };
      } catch (err) {
        logger.warn('Failed to fetch enums from CivitAI API, returning defaults');
        return {
          modelTypes: [
            'Checkpoint',
            'LORA',
            'LoCon',
            'DoRA',
            'TextualInversion',
            'Hypernetwork',
            'VAE',
            'Controlnet',
            'Upscaler',
            'MotionModule',
            'AestheticGradient',
            'Poses',
            'Wildcards',
            'Workflows',
            'Detection',
            'Other',
          ],
          baseModels: [
            'Anima',
            'AuraFlow',
            'Chroma',
            'CogVideoX',
            'Ernie',
            'Flux.1 S',
            'Flux.1 D',
            'Flux.1 Krea',
            'Flux.1 Kontext',
            'Flux.2 D',
            'SD3',
            'SD3 Medium'
          ],
        };
      }
    });
  }

  getDownloadUrl(versionId: number): string {
    const baseDownloadUrl = `https://civitai.com/api/download/models/${versionId}`;
    if (this.apiKey) {
      return `${baseDownloadUrl}?token=${encodeURIComponent(this.apiKey)}`;
    }
    return baseDownloadUrl;
  }
}

export const civitaiClient = new CivitAIClient();
