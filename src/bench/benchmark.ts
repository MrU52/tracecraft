import { TokenBucketRateLimiter } from '../core/resilience/rate-limiter';
import { CircuitBreaker } from '../core/resilience/circuit-breaker';
import { RetryExecutor, JitterStrategy } from '../core/resilience/retry';

const N = 200_000;

async function time(label: string, fn: () => unknown | Promise<unknown>) {
  // warm up so the JIT has seen the code before we measure
  for (let i = 0; i < 5_000; i++) await fn();

  const t0 = performance.now();
  for (let i = 0; i < N; i++) await fn();
  const ms = performance.now() - t0;

  console.log(`${label.padEnd(28)} ${Math.round((N / ms) * 1000).toLocaleString().padStart(12)} ops/s`);
}

console.log(`${N.toLocaleString()} iterations each\n`);

const limiter = new TokenBucketRateLimiter({ capacity: 1e9, refillRatePerSec: 1e9 });
await time('rate limiter tryAcquire', () => limiter.tryAcquire());

const policy = { maxRetries: 5, baseDelayMs: 100, maxDelayMs: 2000, jitter: JitterStrategy.FULL };
await time('retry calculateDelay', () => RetryExecutor.calculateDelay(3, policy));

const open = new CircuitBreaker({ name: 'bench' });
open.forceOpen();
await time('breaker open -> fallback', () => open.execute(async () => 'ok', () => 'fallback'));

const closed = new CircuitBreaker({ name: 'bench' });
await time('breaker closed, success', () => closed.execute(async () => 'ok'));
