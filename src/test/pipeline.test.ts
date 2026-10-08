import { describe, it, expect, vi } from 'vitest';
import { ResiliencePipeline } from '../core/resilience/pipeline';
import { CircuitBreaker, CircuitState } from '../core/resilience/circuit-breaker';
import { TokenBucketRateLimiter } from '../core/resilience/rate-limiter';
import { JitterStrategy } from '../core/resilience/retry';

describe('ResiliencePipeline', () => {
  it('passes a healthy call straight through', async () => {
    const pipeline = new ResiliencePipeline({
      name: 'pay',
      rateLimiter: new TokenBucketRateLimiter({ capacity: 10, refillRatePerSec: 5 }),
      circuitBreaker: new CircuitBreaker({ name: 'pay' }),
      retryPolicy: { maxRetries: 2, baseDelayMs: 10 },
    });

    const res = await pipeline.execute(async () => ({ txId: 'tx_123' }));

    expect(res.status).toBe('SUCCESS');
    expect(res.result).toEqual({ txId: 'tx_123' });
    expect(res.attempts).toBe(1);
    expect(res.remainingTokens).toBe(9);
  });

  it('answers 429-style once the bucket is empty', async () => {
    const pipeline = new ResiliencePipeline({
      name: 'limited',
      rateLimiter: new TokenBucketRateLimiter({ capacity: 2, refillRatePerSec: 0.1 }),
    });

    await pipeline.execute(async () => 'ok');
    await pipeline.execute(async () => 'ok');

    const op = vi.fn(async () => 'nope');
    const res = await pipeline.execute(op);

    expect(res.status).toBe('RATE_LIMITED');
    expect(res.error?.message).toMatch(/Rate limit/);
    expect(op).not.toHaveBeenCalled();
  });

  it('skips the call entirely while the breaker is open', async () => {
    const breaker = new CircuitBreaker({ name: 'broken' });
    breaker.forceOpen();
    const pipeline = new ResiliencePipeline({ name: 'broken', circuitBreaker: breaker });

    const op = vi.fn(async () => 'val');
    const res = await pipeline.execute(op);

    expect(op).not.toHaveBeenCalled();
    expect(res.status).toBe('CIRCUIT_OPEN');
    expect(res.circuitState).toBe(CircuitState.OPEN);
    expect(res.error?.message).toMatch(/is OPEN/);
  });

  it('retries a flaky call and reports RETRIED', async () => {
    let calls = 0;
    const pipeline = new ResiliencePipeline({
      name: 'flaky',
      retryPolicy: { maxRetries: 3, baseDelayMs: 5, maxDelayMs: 20, jitter: JitterStrategy.NONE },
    });

    const res = await pipeline.execute(async () => {
      if (++calls < 3) throw new Error('504');
      return 'recovered';
    });

    expect(res.status).toBe('RETRIED');
    expect(res.result).toBe('recovered');
    expect(res.attempts).toBe(3);
    expect(res.totalBackoffDelayMs).toBe(15);
    expect(res.attemptLogs.map((l) => l.backoffDelayMs)).toEqual([5, 10, undefined]);
  });

  it('hands back the fallback value when every attempt fails', async () => {
    const pipeline = new ResiliencePipeline({
      name: 'failing',
      retryPolicy: { maxRetries: 1, baseDelayMs: 5 },
    });

    const res = await pipeline.execute(
      async () => {
        throw new Error('500');
      },
      () => ({ cached: true })
    );

    expect(res.status).toBe('FAILED');
    expect(res.result).toEqual({ cached: true });
    expect(res.error?.message).toBe('500');
    expect(res.attempts).toBe(2);
  });

  it('reports the original error if the fallback throws too', async () => {
    const pipeline = new ResiliencePipeline({ name: 'f', retryPolicy: { maxRetries: 0 } });

    const res = await pipeline.execute(
      async () => {
        throw new Error('primary');
      },
      () => {
        throw new Error('fallback');
      }
    );

    expect(res.status).toBe('FAILED');
    expect(res.result).toBeUndefined();
    expect(res.error?.message).toBe('primary');
  });

  it('counts one pipeline call as one breaker outcome, however many retries it took', async () => {
    const breaker = new CircuitBreaker({ name: 'b' });
    const pipeline = new ResiliencePipeline({
      name: 'b',
      circuitBreaker: breaker,
      retryPolicy: { maxRetries: 2, baseDelayMs: 1, maxDelayMs: 2 },
    });

    await pipeline.execute(async () => {
      throw new Error('x');
    });

    expect(breaker.getMetrics().totalCalls).toBe(1);
  });
});
