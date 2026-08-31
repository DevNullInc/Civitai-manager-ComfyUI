/**
 * Renegade Core Model Manager (RenegadeCMM)
 * Copyright (C) 2025-2026 TheStygianRenegade / /dev/null Inc
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import log from 'electron-log';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogEntryPayload = { level: 'info' | 'warn' | 'error' | 'log'; message: string };
type LogListener = (entry: LogEntryPayload) => void;

class Logger {
  private listeners: Set<LogListener> = new Set();

  constructor() {
    log.transports.file.level = 'info';
    log.transports.console.level = 'debug';
  }

  onLog(listener: LogListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(level: 'info' | 'warn' | 'error' | 'log', message: string, ...args: any[]) {
    const formatted = args.length > 0 ? `${message} ${args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')}` : message;
    this.listeners.forEach((fn) => {
      try {
        fn({ level, message: formatted });
      } catch (e) {}
    });
  }

  setLevel(level: LogLevel) {
    log.transports.file.level = level;
  }

  debug(message: string, ...args: any[]) {
    log.debug(message, ...args);
  }

  info(message: string, ...args: any[]) {
    log.info(message, ...args);
    this.emit('info', message, ...args);
  }

  warn(message: string, ...args: any[]) {
    log.warn(message, ...args);
    this.emit('warn', message, ...args);
  }

  error(message: string, ...args: any[]) {
    log.error(message, ...args);
    this.emit('error', message, ...args);
  }
}

export const logger = new Logger();
