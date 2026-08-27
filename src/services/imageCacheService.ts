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
import path from 'path';
import crypto from 'crypto';
import axios from 'axios';
import { app } from 'electron';
import { logger } from '../utils/logger';

interface CachedImageEntry {
  buffer: Buffer;
  contentType: string;
  timestamp: number;
}

export class ImageCacheService {
  private libraryCacheDir: string;
  private browseSessionCache: Map<string, CachedImageEntry> = new Map();
  private maxBrowseEntries: number = 500;
  private inflightRequests: Map<string, Promise<{ buffer: Buffer; contentType: string } | null>> = new Map();
  private readonly allowedImageHosts: string[] = ['civitai.com', 'image.civitai.com'];

  constructor() {
    let baseDir = process.cwd();
    try {
      if (app && typeof app.getPath === 'function') {
        baseDir = app.getPath('userData');
      }
    } catch {
      baseDir = process.cwd();
    }
    this.libraryCacheDir = path.join(baseDir, 'cache', 'library_thumbnails');
    this.ensureDirectory(this.libraryCacheDir);
  }

  private ensureDirectory(dir: string) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch (err) {
      logger.warn(`Failed to create image cache directory at ${dir}:`, err);
    }
  }

  private hashUrl(url: string): string {
    return crypto.createHash('sha256').update(url.trim()).digest('hex');
  }

  private getDiskPaths(url: string): { dataPath: string; metaPath: string } {
    const hash = this.hashUrl(url);
    return {
      dataPath: path.join(this.libraryCacheDir, `${hash}.bin`),
      metaPath: path.join(this.libraryCacheDir, `${hash}.meta`),
    };
  }

  /**
   * Check if image is permanently cached in library cache
   */
  public hasLibraryCache(url: string): boolean {
    if (!url) return false;
    const { dataPath, metaPath } = this.getDiskPaths(url);
    return fs.existsSync(dataPath) && fs.existsSync(metaPath);
  }

  private isPrivateOrLocalHost(hostname: string): boolean {
    const host = hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.localhost') || host === '0.0.0.0') return true;

    const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4Match) {
      const octets = ipv4Match.slice(1).map((n) => Number(n));
      if (octets.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
      const [a, b] = octets;
      if (a === 10 || a === 127 || a === 0) return true;
      if (a === 169 && b === 254) return true;
      if (a === 172 && b >= 16 && b <= 31) return true;
      if (a === 192 && b === 168) return true;
      if (a >= 224) return true;
    }

    return host === '::1' || host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd');
  }

  private isAllowedImageUrl(rawUrl: string): URL | null {
    try {
      const parsed = new URL(rawUrl.trim());
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
      const hostname = parsed.hostname.toLowerCase();
      if (this.isPrivateOrLocalHost(hostname)) return null;

      const isAllowedHost = this.allowedImageHosts.some(
        (allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`)
      );
      if (!isAllowedHost) return null;

      return parsed;
    } catch {
      return null;
    }
  }

  /**
   * Fetch image with caching according to target context:
   * - 'library': Permanent disk cache (persists across sessions)
   * - 'browse': Temporary in-memory session cache (cleared on restart)
   */
  public async getImage(
    url: string,
    type: 'library' | 'browse' = 'library'
  ): Promise<{ buffer: Buffer; contentType: string } | null> {
    if (!url || typeof url !== 'string') {
      return null;
    }

    const validatedUrl = this.isAllowedImageUrl(url);
    if (!validatedUrl) {
      logger.warn('[ImageCache] Blocked image request due to invalid or disallowed URL');
      return null;
    }

    const cleanUrl = validatedUrl.toString();
    const cacheKey = `${type}:${cleanUrl}`;

    // 1. Check if already cached
    if (type === 'library') {
      const { dataPath, metaPath } = this.getDiskPaths(cleanUrl);
      if (fs.existsSync(dataPath) && fs.existsSync(metaPath)) {
        try {
          const buffer = fs.readFileSync(dataPath);
          const metaJson = fs.readFileSync(metaPath, 'utf8');
          const meta = JSON.parse(metaJson);
          return { buffer, contentType: meta.contentType || 'image/jpeg' };
        } catch (e) {
          logger.warn(`Failed reading permanent thumbnail cache for ${cleanUrl}:`, e);
        }
      }
    } else {
      // Browse Session Cache
      if (this.browseSessionCache.has(cleanUrl)) {
        const entry = this.browseSessionCache.get(cleanUrl)!;
        entry.timestamp = Date.now();
        return { buffer: entry.buffer, contentType: entry.contentType };
      }
    }

    // 2. Prevent duplicate in-flight network requests for same URL
    if (this.inflightRequests.has(cacheKey)) {
      return await this.inflightRequests.get(cacheKey)!;
    }

    const fetchPromise = (async () => {
      try {
        const response = await axios.get(cleanUrl, {
          responseType: 'arraybuffer',
          timeout: 15000,
          headers: {
            'User-Agent': 'CivitAI-Model-Manager-ComfyUI/1.3.0',
            Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          },
        });

        const buffer = Buffer.from(response.data);
        const rawContentType = response.headers['content-type'];
        const contentType: string = typeof rawContentType === 'string' ? rawContentType : 'image/jpeg';

        if (type === 'library') {
          // Write to permanent disk cache
          this.ensureDirectory(this.libraryCacheDir);
          const { dataPath, metaPath } = this.getDiskPaths(cleanUrl);
          fs.writeFileSync(dataPath, buffer);
          fs.writeFileSync(
            metaPath,
            JSON.stringify({
              url: cleanUrl,
              contentType,
              cachedAt: new Date().toISOString(),
              size: buffer.length,
            })
          );
        } else {
          // Store in temporary browse session cache
          if (this.browseSessionCache.size >= this.maxBrowseEntries) {
            // Evict oldest item
            let oldestKey: string | null = null;
            let oldestTime = Infinity;
            for (const [k, v] of this.browseSessionCache.entries()) {
              if (v.timestamp < oldestTime) {
                oldestTime = v.timestamp;
                oldestKey = k;
              }
            }
            if (oldestKey) this.browseSessionCache.delete(oldestKey);
          }

          this.browseSessionCache.set(cleanUrl, {
            buffer,
            contentType,
            timestamp: Date.now(),
          });
        }

        return { buffer, contentType };
      } catch (err: any) {
        logger.warn(`[ImageCache] Failed to download thumbnail for ${cleanUrl}:`, err?.message || err);
        return null;
      } finally {
        this.inflightRequests.delete(cacheKey);
      }
    })();

    this.inflightRequests.set(cacheKey, fetchPromise);
    return await fetchPromise;
  }

  /**
   * Asynchronously prefetch thumbnail into permanent library disk cache in background
   */
  public prefetchToPermanentCache(url?: string): void {
    if (!url || typeof url !== 'string' || !url.startsWith('http')) return;
    const cleanUrl = url.trim();
    if (this.hasLibraryCache(cleanUrl)) return;

    // Fire-and-forget in background
    this.getImage(cleanUrl, 'library').catch(() => {});
  }

  /**
   * Promote an image from temporary session cache to permanent library cache
   */
  public promoteToPermanentCache(url?: string): void {
    if (!url || typeof url !== 'string' || !url.startsWith('http')) return;
    const cleanUrl = url.trim();
    if (this.hasLibraryCache(cleanUrl)) return;

    if (this.browseSessionCache.has(cleanUrl)) {
      const entry = this.browseSessionCache.get(cleanUrl)!;
      try {
        this.ensureDirectory(this.libraryCacheDir);
        const { dataPath, metaPath } = this.getDiskPaths(cleanUrl);
        fs.writeFileSync(dataPath, entry.buffer);
        fs.writeFileSync(
          metaPath,
          JSON.stringify({
            url: cleanUrl,
            contentType: entry.contentType,
            cachedAt: new Date().toISOString(),
            size: entry.buffer.length,
          })
        );
        return;
      } catch (e) {
        logger.warn(`Failed to promote image to permanent cache: ${cleanUrl}`, e);
      }
    }

    // Otherwise download directly to permanent cache
    this.prefetchToPermanentCache(cleanUrl);
  }

  /**
   * Clear in-memory browse session cache
   */
  public clearBrowseSessionCache(): void {
    this.browseSessionCache.clear();
  }

  /**
   * Clear permanent library disk cache
   */
  public clearPermanentLibraryCache(): void {
    try {
      if (fs.existsSync(this.libraryCacheDir)) {
        const files = fs.readdirSync(this.libraryCacheDir);
        for (const file of files) {
          fs.unlinkSync(path.join(this.libraryCacheDir, file));
        }
      }
    } catch (e) {
      logger.warn('Failed clearing permanent library cache:', e);
    }
  }
}

export const imageCacheService = new ImageCacheService();
