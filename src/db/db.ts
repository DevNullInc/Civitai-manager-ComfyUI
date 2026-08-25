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
