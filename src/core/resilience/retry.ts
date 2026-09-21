/**
 * Retry algorithms with Exponential Backoff and Jitter strategies.
 * Reference: AWS Architecture Blog - Exponential Backoff And Jitter
 */

export enum JitterStrategy {
  NONE = 'NONE',
  FULL = 'FULL',           // sleep = rand(0, min(cap, base * 2^attempt))
  EQUAL = 'EQUAL',         // temp = min(cap, base * 2^attempt); sleep = temp/2 + rand(0, temp/2)
  DECORRELATED = 'DECORRELATED', // sleep = min(cap, rand(base, sleep * 3))
}

export interface RetryPolicy {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitter: JitterStrategy;
  retryableErrors?: (err: unknown) => boolean;
}

export class RetryExecutor {
  public static calculateDelay(
    attempt: number,
    policy: RetryPolicy,
    previousDelay = 0
  ): number {
    const { baseDelayMs, maxDelayMs, jitter } = policy;
    const exponentialBackoff = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt));

    switch (jitter) {
      case JitterStrategy.NONE:
        return exponentialBackoff;

      case JitterStrategy.FULL:
        return Math.floor(Math.random() * (exponentialBackoff + 1));

      case JitterStrategy.EQUAL: {
        const half = Math.floor(exponentialBackoff / 2);
        return half + Math.floor(Math.random() * (half + 1));
      }

      case JitterStrategy.DECORRELATED: {
        const sleep = Math.min(
          maxDelayMs,
          Math.max(baseDelayMs, Math.floor(Math.random() * (previousDelay * 3 - baseDelayMs + 1) + baseDelayMs))
        );
        return sleep;
      }
    }
  }

  public static async executeWithRetry<T>(
    operation: (attempt: number) => Promise<T>,
    policy: Partial<RetryPolicy> = {}
  ): Promise<{ result: T; attempts: number; totalBackoffDelayMs: number }> {
    const fullPolicy: RetryPolicy = {
      maxRetries: 3,
      baseDelayMs: 50,
      maxDelayMs: 2000,
      jitter: JitterStrategy.FULL,
      ...policy,
    };

    let totalBackoffDelayMs = 0;
    let prevDelay = 0;

    for (let attempt = 0; attempt <= fullPolicy.maxRetries; attempt++) {
      try {
        const result = await operation(attempt);
        return { result, attempts: attempt + 1, totalBackoffDelayMs };
      } catch (err) {
        if (attempt === fullPolicy.maxRetries) {
          throw err;
        }

        if (fullPolicy.retryableErrors && !fullPolicy.retryableErrors(err)) {
          throw err;
        }

        const delay = this.calculateDelay(attempt, fullPolicy, prevDelay);
        prevDelay = delay;
        totalBackoffDelayMs += delay;

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error('Retry exhausted');
  }
}
