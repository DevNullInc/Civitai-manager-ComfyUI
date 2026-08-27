/**
 * CivitAI Model Manager - ComfyUI Edition
 * Copyright (C) 2025-2026 TheStygianRenegade / /dev/null Inc
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import axios, { AxiosResponse } from 'axios';
import fs from 'fs';
import path from 'path';
import { DownloadTask, ConflictStrategy } from '../types/app';
import { computeFileSHA256 } from '../utils/hash';
import { sanitizeFileName } from '../utils/pathUtils';
import { dbManager } from '../db/db';
import { logger } from '../utils/logger';

export class DownloadManager {
  private tasks: Map<string, DownloadTask> = new Map();
  private activeDownloads: Map<string, { cancel: () => void; cleanup: () => void }> = new Map();
  private maxConcurrent: number = 2;
  private defaultConflictStrategy: ConflictStrategy = 'rename';
  private strictHashVerification: boolean = true;

  constructor(maxConcurrent = 2) {
    this.maxConcurrent = maxConcurrent;
  }

  setMaxConcurrent(max: number) {
    this.maxConcurrent = Math.max(1, Math.min(10, Math.round(max || 2)));
    logger.info(`Download queue concurrency set to ${this.maxConcurrent}`);
    this.processQueue();
  }

  setConflictStrategy(strategy: ConflictStrategy) {
    this.defaultConflictStrategy = strategy;
  }

  setStrictHashVerification(strict: boolean) {
    this.strictHashVerification = strict;
  }

  getTasks(): DownloadTask[] {
    return Array.from(this.tasks.values());
  }

  getTask(id: string): DownloadTask | undefined {
    return this.tasks.get(id);
  }

  addTask(task: Omit<DownloadTask, 'id' | 'status' | 'progress' | 'downloadedBytes' | 'totalBytes' | 'speedBps'>): DownloadTask {
    const id = `dl_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const fullTask: DownloadTask = {
      ...task,
      id,
      status: 'pending',
      progress: 0,
      downloadedBytes: 0,
      totalBytes: Math.round(task.sizeKB * 1024),
      speedBps: 0,
    };

    this.tasks.set(id, fullTask);
    this.processQueue();
    return fullTask;
  }

  pauseTask(id: string) {
    const active = this.activeDownloads.get(id);
    if (active) {
      active.cancel();
      this.activeDownloads.delete(id);
    }
    const task = this.tasks.get(id);
    if (task && task.status === 'downloading') {
      task.status = 'paused';
      task.speedBps = 0;
      logger.info(`Paused download task: ${task.fileName}`);
    }
  }

  resumeTask(id: string) {
    const task = this.tasks.get(id);
    if (task && (task.status === 'paused' || task.status === 'failed')) {
      task.status = 'pending';
      task.error = undefined;
      this.processQueue();
    }
  }

  cancelTask(id: string) {
    const active = this.activeDownloads.get(id);
    if (active) {
      active.cancel();
      active.cleanup();
      this.activeDownloads.delete(id);
    }
    const task = this.tasks.get(id);
    if (task) {
      // Automatically clean up and delete temporary partial file from disk
      const partFile = `${task.computedPath}.part`;
      try {
        if (fs.existsSync(partFile)) {
          fs.unlinkSync(partFile);
          logger.info(`Deleted partial download file: ${partFile}`);
        }
      } catch (e) {
        logger.warn(`Could not immediately delete partial file ${partFile}:`, e);
      }
      this.tasks.delete(id);
      logger.info(`Cancelled download task and deleted partial data: ${task.fileName}`);
    }
    this.processQueue();
  }

  private async processQueue() {
    const activeCount = Array.from(this.tasks.values()).filter(
      (t) => t.status === 'downloading' || t.status === 'verifying'
    ).length;

    if (activeCount >= this.maxConcurrent) return;

    const nextTask = Array.from(this.tasks.values()).find(
      (t) => t.status === 'pending'
    );

    if (nextTask) {
      this.startDownload(nextTask.id);
    }
  }

  private resolveConflict(targetPath: string, strategy: ConflictStrategy): string | null {
    if (!fs.existsSync(targetPath)) return targetPath;

    if (strategy === 'skip') {
      logger.info(`File already exists, skipping: ${targetPath}`);
      return null;
    }

    if (strategy === 'replace') {
      logger.info(`File already exists, overwriting: ${targetPath}`);
      return targetPath;
    }

    if (strategy === 'rename') {
      const ext = path.extname(targetPath);
      const base = targetPath.slice(0, -ext.length);
      let counter = 1;
      let newPath = `${base}_v${counter}${ext}`;
      while (fs.existsSync(newPath)) {
        counter++;
        newPath = `${base}_v${counter}${ext}`;
      }
      logger.info(`File exists, renaming to: ${newPath}`);
      return newPath;
    }

    return targetPath;
  }

  private async startDownload(id: string) {
    const task = this.tasks.get(id);
    if (!task) return;

    task.status = 'downloading';
    let targetPath = task.computedPath;

    // Handle conflict resolution
    const resolvedPath = this.resolveConflict(targetPath, this.defaultConflictStrategy);
    if (!resolvedPath) {
      task.status = 'completed';
      task.progress = 100;
      this.processQueue();
      return;
    }
    task.computedPath = resolvedPath;

    const partFile = `${resolvedPath}.part`;
    const targetDir = path.dirname(resolvedPath);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    let existingBytes = 0;
    if (fs.existsSync(partFile)) {
      existingBytes = fs.statSync(partFile).size;
    }

    const cancelTokenSource = axios.CancelToken.source();
    let writeStream: fs.WriteStream | null = null;
    this.activeDownloads.set(id, {
      cancel: () => cancelTokenSource.cancel('Download cancelled by user'),
      cleanup: () => {
        try {
          if (writeStream && !writeStream.destroyed) {
            writeStream.destroy();
          }
        } catch (e) {}
      },
    });

    let lastTime = Date.now();
    let lastBytes = existingBytes;

    try {
      const makeRequest = async (useRange: boolean): Promise<AxiosResponse> => {
        const headers: Record<string, string> = {
          'User-Agent': 'CivitAI-Model-Manager-ComfyUI/1.1',
        };
        if (useRange && existingBytes > 0) {
          headers['Range'] = `bytes=${existingBytes}-`;
        }
        return await axios.get(task.downloadUrl, {
          responseType: 'stream',
          headers,
          cancelToken: cancelTokenSource.token,
          maxRedirects: 5,
        });
      };

      let response: AxiosResponse;
      try {
        response = await makeRequest(true);
      } catch (reqErr: any) {
        // If HTTP 416 Range Not Satisfiable (e.g. stale/corrupted .part file or CDN offset mismatch), retry clean from byte 0
        if (
          reqErr.response?.status === 416 ||
          reqErr.message?.includes('416') ||
          (reqErr.response && reqErr.response.status >= 400 && reqErr.response.status < 500 && existingBytes > 0)
        ) {
          logger.warn(
            `Download range request returned error (${reqErr.message}) for ${task.fileName}. Cleaning partial file and restarting from beginning.`
          );
          try {
            if (fs.existsSync(partFile)) {
              fs.unlinkSync(partFile);
            }
          } catch (e) {}
          existingBytes = 0;
          task.downloadedBytes = 0;
          lastBytes = 0;
          response = await makeRequest(false);
        } else {
          throw reqErr;
        }
      }

      // Check if server returned 206 Partial Content or full 200 OK
      const isPartial = response.status === 206;
      if (!isPartial) {
        existingBytes = 0;
        task.downloadedBytes = 0;
        lastBytes = 0;
      } else {
        task.downloadedBytes = existingBytes;
        lastBytes = existingBytes;
      }

      const contentLengthRaw = response.headers['content-length'];
      const totalLength = parseInt(
        Array.isArray(contentLengthRaw)
          ? contentLengthRaw[0]
          : String(contentLengthRaw || '0'),
        10
      );
      if (totalLength > 0) {
        task.totalBytes = existingBytes + totalLength;
      }

      writeStream = fs.createWriteStream(partFile, {
        flags: isPartial && existingBytes > 0 ? 'a' : 'w',
      });

      response.data.on('data', (chunk: Buffer) => {
        task.downloadedBytes += chunk.length;
        const now = Date.now();
        const timeDiff = (now - lastTime) / 1000;
        if (timeDiff >= 0.5) {
          const bytesDiff = task.downloadedBytes - lastBytes;
          task.speedBps = Math.round(bytesDiff / timeDiff);
          lastTime = now;
          lastBytes = task.downloadedBytes;
        }

        if (task.totalBytes > 0) {
          task.progress = Math.min(
            99,
            Math.round((task.downloadedBytes / task.totalBytes) * 100)
          );
        }
      });

      await new Promise<void>((resolve, reject) => {
        if (!writeStream) return resolve();
        writeStream.on('finish', () => resolve());
        writeStream.on('error', reject);
        response.data.on('error', reject);
        response.data.pipe(writeStream);
      });

      this.activeDownloads.delete(id);

      // Verify SHA256 Hash if provided
      if (task.sha256) {
        task.status = 'verifying';
        logger.info(`Verifying SHA256 hash for task: ${task.fileName}`);
        const computedHash = await computeFileSHA256(partFile);
        if (computedHash.toUpperCase() !== task.sha256.toUpperCase()) {
          if (!this.strictHashVerification) {
            logger.warn(
              `SHA256 hash mismatch ignored (strict mode off): Expected ${task.sha256}, got ${computedHash}. Finalizing download.`
            );
          } else {
            task.status = 'failed';
            task.isHashMismatch = true;
            task.error = `SHA256 hash mismatch! Expected ${task.sha256}, got ${computedHash}`;
            logger.error(task.error);
            this.processQueue();
            return;
          }
        }
      }

      // Atomic rename from .part to final destination
      if (fs.existsSync(resolvedPath)) {
        fs.unlinkSync(resolvedPath);
      }
      fs.renameSync(partFile, resolvedPath);

      // If task requested to delete superseded old version upon successful download completion
      if (task.deleteOldVersionFile && typeof task.deleteOldVersionFile === 'string') {
        try {
          const oldPath = path.resolve(task.deleteOldVersionFile);
          const newPath = path.resolve(resolvedPath);
          if (oldPath !== newPath && fs.existsSync(oldPath)) {
            fs.unlinkSync(oldPath);
            logger.info(`Deleted superseded version file after successful update: ${oldPath}`);
            if (task.deleteOldModelId) {
              await dbManager.run('DELETE FROM local_models WHERE id = ?;', [task.deleteOldModelId]);
            } else {
              await dbManager.run('DELETE FROM local_models WHERE file_path = ?;', [oldPath]);
            }
          }
        } catch (delErr) {
          logger.warn(`Failed to delete superseded version file ${task.deleteOldVersionFile}:`, delErr);
        }
      }

      task.status = 'completed';
      task.progress = 100;
      task.speedBps = 0;
      task.isHashMismatch = false;
      logger.info(`Successfully completed download: ${task.fileName} -> ${resolvedPath}`);
    } catch (err: any) {
      this.activeDownloads.delete(id);
      if (axios.isCancel(err)) {
        logger.info(`Download task cancelled/paused: ${task.fileName}`);
      } else {
        task.status = 'failed';
        task.error = err.message || 'Unknown download error';
        logger.error(`Download failed for task ${task.fileName}:`, err);
      }
    }

    this.processQueue();
  }

  async forceCompleteTask(id: string): Promise<boolean> {
    const task = this.tasks.get(id);
    if (!task) return false;

    const partFile = `${task.computedPath}.part`;
    try {
      if (fs.existsSync(partFile)) {
        if (fs.existsSync(task.computedPath)) {
          fs.unlinkSync(task.computedPath);
        }
        fs.renameSync(partFile, task.computedPath);
      } else if (!fs.existsSync(task.computedPath)) {
        logger.error(`Cannot force-finish task ${task.fileName}: neither .part nor final file exists.`);
        return false;
      }

      task.status = 'completed';
      task.progress = 100;
      task.speedBps = 0;
      task.error = undefined;
      task.isHashMismatch = false;
      logger.info(`Manually forced download completion for: ${task.fileName} -> ${task.computedPath}`);
      return true;
    } catch (err: any) {
      logger.error(`Failed to force complete download task ${task.fileName}:`, err);
      task.error = `Force completion failed: ${err?.message || err}`;
      return false;
    }
  }
}

export const downloadManager = new DownloadManager();
