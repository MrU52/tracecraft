import { CircuitBreaker, CircuitState } from './circuit-breaker';
import { TokenBucketRateLimiter } from './rate-limiter';
import { RetryExecutor, RetryPolicy, JitterStrategy } from './retry';

export class RateLimitError extends Error {
  constructor(message = 'Rate limit exceeded: token bucket is empty') {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class CircuitBreakerOpenError extends Error {
  constructor(circuitName: string) {
    super(`Circuit breaker '${circuitName}' is OPEN - request rejected`);
    this.name = 'CircuitBreakerOpenError';
  }
}

export interface AttemptLog {
  attemptNumber: number;
  durationMs: number;
  error?: string;
  backoffDelayMs?: number;
}

export interface PipelineExecutionOutcome<T> {
  status: 'SUCCESS' | 'RETRIED' | 'RATE_LIMITED' | 'CIRCUIT_OPEN' | 'FAILED';
  result?: T;
  error?: Error;
  attempts: number;
  totalBackoffDelayMs: number;
  totalDurationMs: number;
  circuitState: CircuitState;
  remainingTokens: number;
  attemptLogs: AttemptLog[];
}

export interface ResiliencePipelineConfig {
  name: string;
  rateLimiter?: TokenBucketRateLimiter;
  circuitBreaker?: CircuitBreaker;
  retryPolicy?: Partial<RetryPolicy>;
}

// Defaults for the pipeline are a bit tighter than RetryExecutor's own.
const PIPELINE_RETRY_DEFAULTS: Partial<RetryPolicy> = {
  maxRetries: 2,
  baseDelayMs: 50,
  maxDelayMs: 1000,
  jitter: JitterStrategy.FULL,
};

export class ResiliencePipeline {
  readonly name: string;
  rateLimiter?: TokenBucketRateLimiter;
  circuitBreaker?: CircuitBreaker;
  retryPolicy?: Partial<RetryPolicy>;

  constructor(config: ResiliencePipelineConfig) {
    this.name = config.name;
    this.rateLimiter = config.rateLimiter;
    this.circuitBreaker = config.circuitBreaker;
    this.retryPolicy = config.retryPolicy;
  }

  async execute<T>(
    operation: (attempt: number) => Promise<T>,
    fallback?: (error: Error) => Promise<T> | T
  ): Promise<PipelineExecutionOutcome<T>> {
    const startedAt = Date.now();
    const attemptLogs: AttemptLog[] = [];

    // Builds the outcome, running the fallback first if there is one. A throwing
    // fallback is swallowed and the original error is reported instead.
    const finish = async (
      status: PipelineExecutionOutcome<T>['status'],
      error: Error,
      stateOverride?: CircuitState
    ): Promise<PipelineExecutionOutcome<T>> => {
      let result: T | undefined;
      let recovered = false;
      if (fallback) {
        try {
          result = await fallback(error);
          recovered = true;
        } catch {
          // fall through and report the original error
        }
      }
      // a failed call keeps its error even when the fallback covered for it;
      // for rejections the fallback result replaces the error
      const keepError = status === 'FAILED' || !recovered;
      return this.outcome(status, startedAt, attemptLogs, stateOverride, {
        result,
        error: keepError ? error : undefined,
      });
    };

    if (this.rateLimiter && !this.rateLimiter.tryAcquire(1)) {
      return finish('RATE_LIMITED', new RateLimitError());
    }

    if (this.circuitBreaker?.getState() === CircuitState.OPEN) {
      return finish('CIRCUIT_OPEN', new CircuitBreakerOpenError(this.circuitBreaker.config.name), CircuitState.OPEN);
    }

    const policy = { ...PIPELINE_RETRY_DEFAULTS, ...this.retryPolicy };
    const run = () =>
      RetryExecutor.executeWithRetry(operation, policy, (info) => {
        attemptLogs.push({
          attemptNumber: info.attempt + 1,
          durationMs: info.durationMs,
          error: info.error === undefined ? undefined : info.error instanceof Error ? info.error.message : String(info.error),
          backoffDelayMs: info.delayMs,
        });
      });

    try {
      const done = await (this.circuitBreaker ? this.circuitBreaker.execute(run) : run());
      return this.outcome(done.attempts > 1 ? 'RETRIED' : 'SUCCESS', startedAt, attemptLogs, undefined, {
        result: done.result,
      });
    } catch (err) {
      return finish('FAILED', err instanceof Error ? err : new Error(String(err)));
    }
  }

  private outcome<T>(
    status: PipelineExecutionOutcome<T>['status'],
    startedAt: number,
    attemptLogs: AttemptLog[],
    stateOverride: CircuitState | undefined,
    extra: { result?: T; error?: Error }
  ): PipelineExecutionOutcome<T> {
    const retried = attemptLogs.filter((l) => l.backoffDelayMs !== undefined);
    return {
      status,
      ...extra,
      attempts: attemptLogs.length,
      totalBackoffDelayMs: retried.reduce((sum, l) => sum + (l.backoffDelayMs ?? 0), 0),
      totalDurationMs: Date.now() - startedAt,
      circuitState: stateOverride ?? this.circuitBreaker?.getState() ?? CircuitState.CLOSED,
      remainingTokens: this.rateLimiter ? this.rateLimiter.getAvailableTokens() : -1,
      attemptLogs,
    };
  }
}
