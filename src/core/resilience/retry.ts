// Backoff formulas are from the AWS Architecture Blog post
// "Exponential Backoff And Jitter".

export enum JitterStrategy {
  NONE = 'NONE',
  FULL = 'FULL',
  EQUAL = 'EQUAL',
  DECORRELATED = 'DECORRELATED',
}

export interface RetryPolicy {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitter: JitterStrategy;
  retryableErrors?: (err: unknown) => boolean;
}

export interface AttemptInfo {
  attempt: number; // 0-based
  durationMs: number;
  error?: unknown;
  delayMs?: number; // set when we're about to sleep and try again
}

export const DEFAULT_POLICY: RetryPolicy = {
  maxRetries: 3,
  baseDelayMs: 50,
  maxDelayMs: 2000,
  jitter: JitterStrategy.FULL,
};

export class RetryExecutor {
  static calculateDelay(attempt: number, policy: RetryPolicy, previousDelay = 0): number {
    const { baseDelayMs, maxDelayMs, jitter } = policy;
    const ceiling = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);

    switch (jitter) {
      case JitterStrategy.NONE:
        return ceiling;

      case JitterStrategy.FULL:
        return Math.floor(Math.random() * (ceiling + 1));

      case JitterStrategy.EQUAL: {
        const half = Math.floor(ceiling / 2);
        return half + Math.floor(Math.random() * (half + 1));
      }

      case JitterStrategy.DECORRELATED: {
        const upper = Math.max(baseDelayMs, previousDelay * 3);
        const pick = baseDelayMs + Math.floor(Math.random() * (upper - baseDelayMs + 1));
        return Math.min(maxDelayMs, pick);
      }
    }
  }

  static async executeWithRetry<T>(
    operation: (attempt: number) => Promise<T>,
    policy: Partial<RetryPolicy> = {},
    onAttempt?: (info: AttemptInfo) => void
  ): Promise<{ result: T; attempts: number; totalBackoffDelayMs: number }> {
    const p: RetryPolicy = { ...DEFAULT_POLICY, ...policy };
    let totalBackoffDelayMs = 0;
    let prevDelay = 0;

    for (let attempt = 0; ; attempt++) {
      const started = Date.now();
      try {
        const result = await operation(attempt);
        onAttempt?.({ attempt, durationMs: Date.now() - started });
        return { result, attempts: attempt + 1, totalBackoffDelayMs };
      } catch (error) {
        const durationMs = Date.now() - started;
        const giveUp = attempt >= p.maxRetries || (p.retryableErrors && !p.retryableErrors(error));
        if (giveUp) {
          onAttempt?.({ attempt, durationMs, error });
          throw error;
        }

        const delayMs = this.calculateDelay(attempt, p, prevDelay);
        prevDelay = delayMs;
        totalBackoffDelayMs += delayMs;
        onAttempt?.({ attempt, durationMs, error, delayMs });
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
}
