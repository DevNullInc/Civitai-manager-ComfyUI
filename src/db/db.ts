/**
 * CivitAI Model Manager - ComfyUI Edition
 * Copyright (C) 2025-2026 TheStygianRenegade / /dev/null Inc
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { logger } from '../utils/logger';

export class DatabaseManager {
  private db: sqlite3.Database | null = null;
  private dbPath: string;

  constructor(customDbPath?: string) {
    this.dbPath = customDbPath || path.join(process.cwd(), 'civitai_manager.sqlite');
  }

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, async (err) => {
        if (err) {
          logger.error('Failed to open SQLite database:', err);
          return reject(err);
        }

        try {
          // Enable Write-Ahead Logging (WAL) for concurrent read/write support
          await this.exec('PRAGMA journal_mode = WAL;');
          await this.exec('PRAGMA foreign_keys = ON;');
          await this.ensureBaseSchema();
          await this.runMigrations();
          await this.cleanupPhantomDuplicates();
          logger.info(`SQLite database initialized at: ${this.dbPath}`);
          resolve();
        } catch (migrationErr) {
          reject(migrationErr);
        }
      });
    });
  }

  private async ensureBaseSchema(): Promise<void> {
    // 1. App Configuration Table (Key-Value)
    await this.exec(`
      CREATE TABLE IF NOT EXISTS app_config (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);

    // 2. Local Models Table
    await this.exec(`
      CREATE TABLE IF NOT EXISTS local_models (
        id TEXT PRIMARY KEY,
        file_path TEXT NOT NULL UNIQUE,
        file_name TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        modified_at INTEGER NOT NULL,
        sha256 TEXT,
        civitai_model_id INTEGER,
        civitai_version_id INTEGER,
        civitai_name TEXT,
        scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_duplicate INTEGER DEFAULT 0,
        preview_url TEXT,
        model_type TEXT,
        nsfw INTEGER DEFAULT 0,
        has_update INTEGER DEFAULT 0,
        update_version_id INTEGER,
        update_version_name TEXT,
        update_download_url TEXT,
        ignored_version_id INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_local_models_sha256 ON local_models(sha256);
      CREATE INDEX IF NOT EXISTS idx_local_models_civitai_version ON local_models(civitai_version_id);
      CREATE INDEX IF NOT EXISTS idx_local_models_civitai_model ON local_models(civitai_model_id);
      CREATE INDEX IF NOT EXISTS idx_local_models_file_path ON local_models(file_path);
    `);

    // 3. Downloads Table
    await this.exec(`
      CREATE TABLE IF NOT EXISTS downloads (
        id TEXT PRIMARY KEY,
        model_version_id INTEGER NOT NULL,
        model_id INTEGER NOT NULL,
        model_name TEXT NOT NULL,
        version_name TEXT NOT NULL,
        model_type TEXT NOT NULL,
        base_model TEXT,
        target_folder TEXT NOT NULL,
        file_name TEXT NOT NULL,
        download_url TEXT NOT NULL,
        size_kb INTEGER,
        sha256 TEXT,
        status TEXT DEFAULT 'pending',
        progress INTEGER DEFAULT 0,
        downloaded_bytes INTEGER DEFAULT 0,
        total_bytes INTEGER DEFAULT 0,
        speed_bps INTEGER DEFAULT 0,
        error TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        computed_path TEXT,
        delete_old_version_file TEXT,
        delete_old_model_id TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_downloads_status ON downloads(status);
    `);

    // 4. Ignored Model Updates Table
    await this.exec(`
      CREATE TABLE IF NOT EXISTS ignored_model_updates (
        model_id INTEGER,
        version_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (model_id, version_id)
      );
    `);

    // 5. Ignored Duplicates Table
    await this.exec(`
      CREATE TABLE IF NOT EXISTS ignored_duplicates (
        sha256 TEXT PRIMARY KEY,
        known_count INTEGER DEFAULT 2,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Ensure all columns exist for existing database files (graceful migration)
    const columnUpdates = [
      'ALTER TABLE local_models ADD COLUMN preview_url TEXT;',
      'ALTER TABLE local_models ADD COLUMN model_type TEXT;',
      'ALTER TABLE local_models ADD COLUMN nsfw INTEGER DEFAULT 0;',
      'ALTER TABLE local_models ADD COLUMN civitai_name TEXT;',
      'ALTER TABLE local_models ADD COLUMN has_update INTEGER DEFAULT 0;',
      'ALTER TABLE local_models ADD COLUMN update_version_id INTEGER;',
      'ALTER TABLE local_models ADD COLUMN update_version_name TEXT;',
      'ALTER TABLE local_models ADD COLUMN update_download_url TEXT;',
      'ALTER TABLE local_models ADD COLUMN ignored_version_id INTEGER;',
      'ALTER TABLE downloads ADD COLUMN delete_old_version_file TEXT;',
      'ALTER TABLE downloads ADD COLUMN delete_old_model_id TEXT;',
    ];

    for (const sql of columnUpdates) {
      await this.exec(sql).catch(() => {});
    }
  }

  private async runMigrations(): Promise<void> {
    const versionRow: any = await this.get('PRAGMA user_version;');
    const currentVersion = versionRow ? versionRow.user_version : 0;
    logger.info(`Current SQLite schema version: ${currentVersion}`);

    const migrationsDir = path.join(process.cwd(), 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      // Standalone execution without external SQL files
      await this.exec('PRAGMA user_version = 8;').catch(() => {});
      return;
    }

    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of migrationFiles) {
      const match = file.match(/^(\d+)_/);
      if (!match) continue;

      const fileVersion = parseInt(match[1], 10);
      if (fileVersion > currentVersion) {
        logger.info(`Applying migration: ${file}`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        try {
          await this.exec(sql);
        } catch (e: any) {
          // Gracefully ignore duplicate column / table already exists errors
          if (!e.message?.includes('duplicate column') && !e.message?.includes('already exists')) {
            logger.warn(`Migration ${file} notice:`, e.message);
          }
        }
        await this.exec(`PRAGMA user_version = ${fileVersion};`).catch(() => {});
      }
    }
  }

  exec(sql: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error('Database not initialized'));
      this.db.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  run(sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error('Database not initialized'));
      this.db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error('Database not initialized'));
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row as T);
      });
    });
  }

  all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error('Database not initialized'));
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve((rows || []) as T[]);
      });
    });
  }

  async cleanupPhantomDuplicates(): Promise<void> {
    try {
      const rows = await this.all('SELECT id, file_path FROM local_models');
      const seenRealPaths = new Map<string, string>();
      const toDelete: string[] = [];

      for (const r of rows) {
        try {
          if (!r.file_path || !fs.existsSync(r.file_path)) {
            toDelete.push(r.id);
            continue;
          }
          let real: string;
          try {
            real = fs.realpathSync.native(r.file_path);
          } catch (e) {
            real = path.resolve(r.file_path);
          }

          const realKey = real.toLowerCase();
          if (seenRealPaths.has(realKey)) {
            toDelete.push(r.id);
          } else {
            seenRealPaths.set(realKey, r.id);
            if (real !== r.file_path) {
              await this.run(
                'UPDATE local_models SET file_path = ?, file_name = ? WHERE id = ?',
                [real, path.basename(real), r.id]
              );
            }
          }
        } catch (e) {
          toDelete.push(r.id);
        }
      }

      for (const id of toDelete) {
        await this.run('DELETE FROM local_models WHERE id = ?', [id]);
      }

      await this.run('UPDATE local_models SET is_duplicate = 0;');
      await this.run(`
        UPDATE local_models 
        SET is_duplicate = 1 
        WHERE sha256 IN (
          SELECT sha256 
          FROM local_models 
          WHERE sha256 IS NOT NULL AND TRIM(sha256) != ''
          GROUP BY sha256 
          HAVING COUNT(DISTINCT file_path COLLATE NOCASE) > 1
        );
      `);

      if (toDelete.length > 0) {
        logger.info(`Cleaned up ${toDelete.length} phantom / missing duplicate records from database.`);
      }
    } catch (err) {
      logger.warn('Failed during startup duplicate database cleanup:', err);
    }
  }

  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) return resolve();
      this.db.close((err) => {
        if (err) reject(err);
        else {
          this.db = null;
          resolve();
        }
      });
    });
  }
}

export const dbManager = new DatabaseManager();
