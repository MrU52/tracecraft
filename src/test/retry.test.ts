import { describe, it, expect, vi } from 'vitest';
import { RetryExecutor, JitterStrategy } from '../core/resilience/retry';

describe('RetryExecutor', () => {
  it('returns immediately on successful first attempt', async () => {
    let callCount = 0;
    const res = await RetryExecutor.executeWithRetry(async () => {
      callCount++;
      return 'ok';
    });

    expect(callCount).toBe(1);
    expect(res.result).toBe('ok');
    expect(res.attempts).toBe(1);
    expect(res.totalBackoffDelayMs).toBe(0);
  });

  it('retries on failure and succeeds on 2nd attempt', async () => {
    let callCount = 0;
    const res = await RetryExecutor.executeWithRetry(
      async () => {
        callCount++;
        if (callCount < 2) {
          throw new Error('Transient 503 error');
        }
        return 'healed';
      },
      {
        maxRetries: 3,
        baseDelayMs: 10,
        maxDelayMs: 50,
        jitter: JitterStrategy.NONE,
      }
    );

    expect(callCount).toBe(2);
    expect(res.result).toBe('healed');
    expect(res.attempts).toBe(2);
    expect(res.totalBackoffDelayMs).toBeGreaterThanOrEqual(10);
  });

  it('throws error when all retry attempts are exhausted', async () => {
    let callCount = 0;
    await expect(
      RetryExecutor.executeWithRetry(
        async () => {
          callCount++;
          throw new Error('Persistent failure');
        },
        {
          maxRetries: 2,
          baseDelayMs: 5,
          maxDelayMs: 20,
        }
      )
    ).rejects.toThrow('Persistent failure');

    // Initial attempt + 2 retries = 3 total attempts
    expect(callCount).toBe(3);
  });

  it('stops immediately if error is not retryable (e.g. 400 Bad Request)', async () => {
    let callCount = 0;
    class BadRequestError extends Error {}

    await expect(
      RetryExecutor.executeWithRetry(
        async () => {
          callCount++;
          throw new BadRequestError('Invalid input payload');
        },
        {
          maxRetries: 3,
          retryableErrors: err => !(err instanceof BadRequestError),
        }
      )
    ).rejects.toThrow('Invalid input payload');

    expect(callCount).toBe(1);
  });

  it('calculates deterministic exponential backoff when jitter is NONE', () => {
    const policy = {
      maxRetries: 3,
      baseDelayMs: 100,
      maxDelayMs: 1000,
      jitter: JitterStrategy.NONE,
    };

    expect(RetryExecutor.calculateDelay(0, policy)).toBe(100);  // 100 * 2^0
    expect(RetryExecutor.calculateDelay(1, policy)).toBe(200);  // 100 * 2^1
    expect(RetryExecutor.calculateDelay(2, policy)).toBe(400);  // 100 * 2^2
    expect(RetryExecutor.calculateDelay(3, policy)).toBe(800);  // 100 * 2^3
    expect(RetryExecutor.calculateDelay(4, policy)).toBe(1000); // capped at maxDelayMs
  });
});
