import { describe, it, expect, vi } from 'vitest';
import { RetryExecutor, JitterStrategy, RetryPolicy } from '../core/resilience/retry';

const policy = (jitter: JitterStrategy): RetryPolicy => ({
  maxRetries: 3,
  baseDelayMs: 100,
  maxDelayMs: 1000,
  jitter,
});

describe('RetryExecutor.executeWithRetry', () => {
  it('returns straight away when the first try works', async () => {
    const op = vi.fn(async () => 'ok');
    const res = await RetryExecutor.executeWithRetry(op);

    expect(op).toHaveBeenCalledTimes(1);
    expect(res).toEqual({ result: 'ok', attempts: 1, totalBackoffDelayMs: 0 });
  });

  it('retries and returns the later success', async () => {
    let calls = 0;
    const res = await RetryExecutor.executeWithRetry(
      async () => {
        if (++calls < 2) throw new Error('503');
        return 'healed';
      },
      { baseDelayMs: 10, maxDelayMs: 50, jitter: JitterStrategy.NONE }
    );

    expect(res.result).toBe('healed');
    expect(res.attempts).toBe(2);
    expect(res.totalBackoffDelayMs).toBe(10);
  });

  it('makes 1 + maxRetries attempts, then rethrows the last error', async () => {
    const op = vi.fn(async () => {
      throw new Error('still down');
    });

    await expect(
      RetryExecutor.executeWithRetry(op, { maxRetries: 2, baseDelayMs: 1, maxDelayMs: 5 })
    ).rejects.toThrow('still down');
    expect(op).toHaveBeenCalledTimes(3);
  });

  it('does not retry errors that retryableErrors rejects', async () => {
    class BadRequest extends Error {}
    const op = vi.fn(async () => {
      throw new BadRequest('bad input');
    });

    await expect(
      RetryExecutor.executeWithRetry(op, { retryableErrors: (e) => !(e instanceof BadRequest) })
    ).rejects.toThrow('bad input');
    expect(op).toHaveBeenCalledTimes(1);
  });

  it('reports every attempt to onAttempt, with the delay on the ones that retried', async () => {
    const seen: { attempt: number; failed: boolean; delay?: number }[] = [];
    let calls = 0;

    await RetryExecutor.executeWithRetry(
      async () => {
        if (++calls < 3) throw new Error('nope');
      },
      { baseDelayMs: 1, maxDelayMs: 4, jitter: JitterStrategy.NONE },
      (i) => seen.push({ attempt: i.attempt, failed: i.error !== undefined, delay: i.delayMs })
    );

    expect(seen).toEqual([
      { attempt: 0, failed: true, delay: 1 },
      { attempt: 1, failed: true, delay: 2 },
      { attempt: 2, failed: false, delay: undefined },
    ]);
  });
});

describe('RetryExecutor.calculateDelay', () => {
  it('doubles each attempt and stops at maxDelayMs with no jitter', () => {
    const p = policy(JitterStrategy.NONE);
    expect([0, 1, 2, 3, 4].map((a) => RetryExecutor.calculateDelay(a, p))).toEqual([100, 200, 400, 800, 1000]);
  });

  it('full jitter stays between 0 and the exponential ceiling', () => {
    const p = policy(JitterStrategy.FULL);
    for (let i = 0; i < 500; i++) {
      const d = RetryExecutor.calculateDelay(2, p);
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThanOrEqual(400);
    }
  });

  it('equal jitter stays in the top half of the ceiling', () => {
    const p = policy(JitterStrategy.EQUAL);
    for (let i = 0; i < 500; i++) {
      const d = RetryExecutor.calculateDelay(2, p);
      expect(d).toBeGreaterThanOrEqual(200);
      expect(d).toBeLessThanOrEqual(400);
    }
  });

  it('decorrelated jitter respects base and cap', () => {
    const p = policy(JitterStrategy.DECORRELATED);
    let prev = 0;
    for (let i = 0; i < 500; i++) {
      prev = RetryExecutor.calculateDelay(i % 5, p, prev);
      expect(prev).toBeGreaterThanOrEqual(100);
      expect(prev).toBeLessThanOrEqual(1000);
    }
  });
});
