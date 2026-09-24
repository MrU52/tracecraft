import { TokenBucketRateLimiter } from '../core/resilience/rate-limiter';
import { CircuitBreaker } from '../core/resilience/circuit-breaker';
import { RetryExecutor, JitterStrategy } from '../core/resilience/retry';

declare const process: { argv: string[] } | undefined;

export function runBenchmark(iterations = 50000) {
  console.log(`\n========================================================`);
  console.log(`TraceCraft Resilience Engine Benchmark (${iterations.toLocaleString()} iterations)`);
  console.log(`========================================================\n`);

  // 1. Token Bucket Rate Limiter Benchmark
  {
    const limiter = new TokenBucketRateLimiter({ capacity: 100000, refillRatePerSec: 50000 });
    const start = performance.now();
    let accepted = 0;

    for (let i = 0; i < iterations; i++) {
      if (limiter.tryAcquire(1)) accepted++;
    }

    const elapsedMs = performance.now() - start;
    const opsPerSec = Math.round((iterations / elapsedMs) * 1000);
    console.log(`Token Bucket Acquire (O(1) continuous time):`);
    console.log(`  - Executed: ${iterations.toLocaleString()} acquires in ${elapsedMs.toFixed(2)}ms`);
    console.log(`  - Throughput: ${opsPerSec.toLocaleString()} ops/sec (Accepted: ${accepted.toLocaleString()})\n`);
  }

  // 2. Exponential Backoff & Jitter Calculation Benchmark
  {
    const policy = {
      maxRetries: 5,
      baseDelayMs: 100,
      maxDelayMs: 2000,
      jitter: JitterStrategy.FULL,
    };

    const start = performance.now();
    let totalDelay = 0;

    for (let i = 0; i < iterations; i++) {
      totalDelay += RetryExecutor.calculateDelay(i % 5, policy, 100);
    }

    const elapsedMs = performance.now() - start;
    const opsPerSec = Math.round((iterations / elapsedMs) * 1000);
    console.log(`Exponential Backoff & Jitter Delay Calculation:`);
    console.log(`  - Executed: ${iterations.toLocaleString()} calculations in ${elapsedMs.toFixed(2)}ms`);
    console.log(`  - Throughput: ${opsPerSec.toLocaleString()} ops/sec\n`);
  }

  // 3. Circuit Breaker Fast-Fail Execution Benchmark
  {
    const breaker = new CircuitBreaker({ name: 'bench-breaker', slidingWindowSize: 10 });
    breaker.forceOpen(); // Benchmark fast-fail throughput

    const start = performance.now();
    let handled = 0;

    for (let i = 0; i < iterations; i++) {
      try {
        breaker.execute(
          async () => 'ok',
          () => 'fallback'
        );
        handled++;
      } catch {
        // fast-fail
      }
    }

    const elapsedMs = performance.now() - start;
    const opsPerSec = Math.round((iterations / elapsedMs) * 1000);
    console.log(`Circuit Breaker Fast-Fail Protection (0ms overhead):`);
    console.log(`  - Executed: ${iterations.toLocaleString()} fast-fails in ${elapsedMs.toFixed(2)}ms`);
    console.log(`  - Throughput: ${opsPerSec.toLocaleString()} ops/sec (Handled: ${handled.toLocaleString()})\n`);
  }

  console.log(`========================================================`);
  console.log(`All benchmarks completed successfully.`);
  console.log(`========================================================\n`);
}

// Allow direct CLI execution
if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('benchmark')) {
  runBenchmark();
}
