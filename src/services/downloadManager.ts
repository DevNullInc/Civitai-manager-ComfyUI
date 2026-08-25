import axios, { AxiosResponse } from 'axios';
import fs from 'fs';
import path from 'path';
import { DownloadTask, ConflictStrategy } from '../types/app';
import { computeFileSHA256 } from '../utils/hash';
import { sanitizeFileName } from '../utils/pathUtils';
import { logger } from '../utils/logger';

export class DownloadManager {
  private tasks: Map<string, DownloadTask> = new Map();
  private activeDownloads: Map<string, { cancel: () => void }> = new Map();
  private maxConcurrent: number = 2;
  private defaultConflictStrategy: ConflictStrategy = 'rename';

  constructor(maxConcurrent = 2) {
    this.maxConcurrent = maxConcurrent;
  }

  setConflictStrategy(strategy: ConflictStrategy) {
    this.defaultConflictStrategy = strategy;
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
      this.activeDownloads.delete(id);
    }
    const task = this.tasks.get(id);
    if (task) {
      // Clean up temp part file if exists
      const partFile = `${task.computedPath}.part`;
      if (fs.existsSync(partFile)) {
        try { fs.unlinkSync(partFile); } catch (e) {}
      }
      this.tasks.delete(id);
      logger.info(`Cancelled download task: ${task.fileName}`);
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
    this.activeDownloads.set(id, { cancel: () => cancelTokenSource.cancel('Download cancelled by user') });

    let lastTime = Date.now();
    let lastBytes = existingBytes;

    try {
      const headers: Record<string, string> = {
        'User-Agent': 'CivitAI-Model-Manager-ComfyUI/1.0',
      };
      if (existingBytes > 0) {
        headers['Range'] = `bytes=${existingBytes}-`;
      }

      const response: AxiosResponse = await axios.get(task.downloadUrl, {
        responseType: 'stream',
        headers,
        cancelToken: cancelTokenSource.token,
        maxRedirects: 5,
      });

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

      const writeStream = fs.createWriteStream(partFile, {
        flags: existingBytes > 0 ? 'a' : 'w',
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
          task.status = 'failed';
          task.error = `SHA256 hash mismatch! Expected ${task.sha256}, got ${computedHash}`;
          logger.error(task.error);
          this.processQueue();
          return;
        }
      }

      // Atomic rename from .part to final destination
      if (fs.existsSync(resolvedPath)) {
        fs.unlinkSync(resolvedPath);
      }
      fs.renameSync(partFile, resolvedPath);

      task.status = 'completed';
      task.progress = 100;
      task.speedBps = 0;
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
}

export const downloadManager = new DownloadManager();
