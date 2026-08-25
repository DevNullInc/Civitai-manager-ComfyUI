import { describe, it, expect } from 'vitest';
import { RateLimiter } from '../src/utils/rateLimiter';

describe('RateLimiter', () => {
  it('should acquire tokens within rate limits', async () => {
    const limiter = new RateLimiter(5);
    const start = Date.now();
    await limiter.acquireToken();
    await limiter.acquireToken();
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(1000);
  });
});
