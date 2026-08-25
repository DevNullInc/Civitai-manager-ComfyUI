import { logger } from './logger';

export class RateLimiter {
  private maxRequestsPerSec: number;
  private tokens: number;
  private lastRefill: number;
  private queue: Array<() => void> = [];
  private isProcessing = false;

  constructor(requestsPerSecond = 10) {
    this.maxRequestsPerSec = requestsPerSecond;
    this.tokens = requestsPerSecond;
    this.lastRefill = Date.now();
  }

  setRateLimit(requestsPerSecond: number) {
    this.maxRequestsPerSec = Math.max(1, requestsPerSecond);
    this.tokens = Math.min(this.tokens, this.maxRequestsPerSec);
  }

  private refillTokens() {
    const now = Date.now();
    const elapsedSec = (now - this.lastRefill) / 1000;
    if (elapsedSec > 0) {
      this.tokens = Math.min(
        this.maxRequestsPerSec,
        this.tokens + elapsedSec * this.maxRequestsPerSec
      );
      this.lastRefill = now;
    }
  }

  async acquireToken(): Promise<void> {
    return new Promise((resolve) => {
      this.queue.push(resolve);
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      this.refillTokens();
      if (this.tokens >= 1) {
        this.tokens -= 1;
        const next = this.queue.shift();
        if (next) next();
      } else {
        const waitMs = Math.ceil((1 - this.tokens) * (1000 / this.maxRequestsPerSec));
        await new Promise((r) => setTimeout(r, Math.max(50, waitMs)));
      }
    }

    this.isProcessing = false;
  }

  async executeWithRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 4,
    initialBackoffMs = 1000
  ): Promise<T> {
    let attempt = 0;
    while (true) {
      try {
        await this.acquireToken();
        return await fn();
      } catch (err: any) {
        attempt++;
        const status = err?.response?.status;
        const isRateLimited = status === 429 || status === 503;

        if (!isRateLimited || attempt > maxRetries) {
          throw err;
        }

        // Check Retry-After header if present
        const retryAfterHeader = err?.response?.headers?.['retry-after'];
        let backoffMs = initialBackoffMs * Math.pow(2, attempt - 1);

        if (retryAfterHeader) {
          const parsedSec = parseInt(retryAfterHeader, 10);
          if (!isNaN(parsedSec)) {
            backoffMs = parsedSec * 1000;
          }
        }

        // Add jitter (0-250ms)
        const jitter = Math.random() * 250;
        const totalWait = backoffMs + jitter;

        logger.warn(
          `API Rate limited (Status ${status}). Retrying attempt ${attempt}/${maxRetries} in ${Math.round(
            totalWait
          )}ms`
        );

        await new Promise((r) => setTimeout(r, totalWait));
      }
    }
  }
}
