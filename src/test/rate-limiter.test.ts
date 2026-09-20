import { describe, it, expect } from 'vitest';
import { TokenBucketRateLimiter } from '../core/resilience/rate-limiter';

describe('TokenBucketRateLimiter', () => {
  it('allows requests up to initial capacity', () => {
    const limiter = new TokenBucketRateLimiter({ capacity: 5, refillRatePerSec: 1 });

    for (let i = 0; i < 5; i++) {
      expect(limiter.tryAcquire(1)).toBe(true);
    }

    // 6th request should be denied
    expect(limiter.tryAcquire(1)).toBe(false);
    expect(limiter.getStats().totalRejected).toBe(1);
    expect(limiter.getStats().totalAccepted).toBe(5);
  });

  it('refills tokens over time', async () => {
    const limiter = new TokenBucketRateLimiter({ capacity: 2, refillRatePerSec: 10 }); // 10 tokens/sec = 1 token per 100ms

    // Exhaust capacity
    expect(limiter.tryAcquire(2)).toBe(true);
    expect(limiter.tryAcquire(1)).toBe(false);

    // Wait 150ms for refill
    await new Promise(r => setTimeout(r, 150));

    // Should have refilled at least 1 token
    expect(limiter.tryAcquire(1)).toBe(true);
  });
});
