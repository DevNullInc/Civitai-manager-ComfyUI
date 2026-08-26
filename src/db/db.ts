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

  private async runMigrations(): Promise<void> {
    const versionRow: any = await this.get('PRAGMA user_version;');
    const currentVersion = versionRow ? versionRow.user_version : 0;
    logger.info(`Current SQLite schema version: ${currentVersion}`);

    const migrationsDir = path.join(process.cwd(), 'migrations');
    if (!fs.existsSync(migrationsDir)) return;

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
        await this.exec(sql);
        await this.exec(`PRAGMA user_version = ${fileVersion};`);
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
