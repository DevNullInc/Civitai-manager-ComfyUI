import log from 'electron-log';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  constructor() {
    log.transports.file.level = 'info';
    log.transports.console.level = 'debug';
  }

  setLevel(level: LogLevel) {
    log.transports.file.level = level;
  }

  debug(message: string, ...args: any[]) {
    log.debug(message, ...args);
  }

  info(message: string, ...args: any[]) {
    log.info(message, ...args);
  }

  warn(message: string, ...args: any[]) {
    log.warn(message, ...args);
  }

  error(message: string, ...args: any[]) {
    log.error(message, ...args);
  }
}

export const logger = new Logger();
