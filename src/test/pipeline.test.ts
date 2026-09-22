import { describe, it, expect } from 'vitest';
import { ResiliencePipeline } from '../core/resilience/pipeline';
import { CircuitBreaker } from '../core/resilience/circuit-breaker';
import { TokenBucketRateLimiter } from '../core/resilience/rate-limiter';
import { JitterStrategy } from '../core/resilience/retry';

describe('ResiliencePipeline Integration', () => {
  it('executes healthy requests successfully on first attempt', async () => {
    const pipeline = new ResiliencePipeline({
      name: 'payment-gateway',
      rateLimiter: new TokenBucketRateLimiter({ capacity: 10, refillRatePerSec: 5 }),
      circuitBreaker: new CircuitBreaker({ name: 'payment-circuit' }),
      retryPolicy: { maxRetries: 2, baseDelayMs: 10 },
    });

    const res = await pipeline.execute(async () => ({ status: 'PAID', txId: 'tx_123' }));

    expect(res.status).toBe('SUCCESS');
    expect(res.result).toEqual({ status: 'PAID', txId: 'tx_123' });
    expect(res.attempts).toBe(1);
    expect(res.remainingTokens).toBe(9);
  });

  it('rejects calls when rate limiter token bucket is exhausted', async () => {
    const limiter = new TokenBucketRateLimiter({ capacity: 2, refillRatePerSec: 0.1 });
    const pipeline = new ResiliencePipeline({
      name: 'limited-api',
      rateLimiter: limiter,
    });

    // 2 allowed
    await pipeline.execute(async () => 'ok');
    await pipeline.execute(async () => 'ok');

    // 3rd rejected by rate limiter
    const res = await pipeline.execute(async () => 'should_not_run');
    expect(res.status).toBe('RATE_LIMITED');
    expect(res.error?.message).toContain('Rate limit exceeded');
  });

  it('fast-fails immediately without running operation when circuit is OPEN', async () => {
    const breaker = new CircuitBreaker({ name: 'test-circuit' });
    breaker.forceOpen();

    let operationCalled = false;
    const pipeline = new ResiliencePipeline({
      name: 'broken-api',
      circuitBreaker: breaker,
    });

    const res = await pipeline.execute(async () => {
      operationCalled = true;
      return 'val';
    });

    expect(operationCalled).toBe(false);
    expect(res.status).toBe('CIRCUIT_OPEN');
    expect(res.error?.message).toContain("is OPEN - request rejected");
  });

  it('retries transient failures and marks outcome as RETRIED', async () => {
    let attempts = 0;
    const pipeline = new ResiliencePipeline({
      name: 'flaky-service',
      retryPolicy: {
        maxRetries: 3,
        baseDelayMs: 5,
        maxDelayMs: 20,
        jitter: JitterStrategy.NONE,
      },
    });

    const res = await pipeline.execute(async () => {
      attempts++;
      if (attempts < 3) {
        throw new Error('Connection timeout 504');
      }
      return 'recovered';
    });

    expect(res.status).toBe('RETRIED');
    expect(res.attempts).toBe(3);
    expect(res.result).toBe('recovered');
    expect(res.totalBackoffDelayMs).toBeGreaterThanOrEqual(15);
  });

  it('uses fallback response when primary call fails completely', async () => {
    const pipeline = new ResiliencePipeline({
      name: 'failing-service',
      retryPolicy: { maxRetries: 1, baseDelayMs: 5 },
    });

    const res = await pipeline.execute(
      async () => {
        throw new Error('Downstream 500 error');
      },
      () => ({ cached: true, offlineData: [1, 2, 3] })
    );

    expect(res.status).toBe('FAILED');
    expect(res.result).toEqual({ cached: true, offlineData: [1, 2, 3] });
  });
});
