import { describe, it, expect, vi, afterEach } from 'vitest';
import { TokenBucketRateLimiter } from '../core/resilience/rate-limiter';

describe('TokenBucketRateLimiter', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('lets a burst through up to capacity, then says no', () => {
    const limiter = new TokenBucketRateLimiter({ capacity: 5, refillRatePerSec: 1 });

    for (let i = 0; i < 5; i++) {
      expect(limiter.tryAcquire()).toBe(true);
    }
    expect(limiter.tryAcquire()).toBe(false);

    const stats = limiter.getStats();
    expect(stats.totalAccepted).toBe(5);
    expect(stats.totalRejected).toBe(1);
  });

  it('refills as time passes', () => {
    vi.useFakeTimers();
    const limiter = new TokenBucketRateLimiter({ capacity: 2, refillRatePerSec: 10 });

    expect(limiter.tryAcquire(2)).toBe(true);
    expect(limiter.tryAcquire()).toBe(false);

    vi.advanceTimersByTime(150); // 1.5 tokens
    expect(limiter.tryAcquire()).toBe(true);
    expect(limiter.tryAcquire()).toBe(false);
  });

  it('never refills past capacity', () => {
    vi.useFakeTimers();
    const limiter = new TokenBucketRateLimiter({ capacity: 3, refillRatePerSec: 100 });

    vi.advanceTimersByTime(10_000);
    expect(limiter.getAvailableTokens()).toBe(3);
  });

  it('can take several tokens in one call', () => {
    const limiter = new TokenBucketRateLimiter({ capacity: 4, refillRatePerSec: 0 });
    expect(limiter.tryAcquire(3)).toBe(true);
    expect(limiter.tryAcquire(2)).toBe(false);
    expect(limiter.tryAcquire(1)).toBe(true);
  });

  it('reset() refills the bucket and clears the counters', () => {
    const limiter = new TokenBucketRateLimiter({ capacity: 2, refillRatePerSec: 0 });
    limiter.tryAcquire(2);
    limiter.tryAcquire();

    limiter.reset();

    expect(limiter.getAvailableTokens()).toBe(2);
    expect(limiter.getStats().totalRejected).toBe(0);
  });
});
