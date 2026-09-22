import { CircuitBreaker, CircuitState } from './circuit-breaker';
import { TokenBucketRateLimiter } from './rate-limiter';
import { RetryExecutor, RetryPolicy, JitterStrategy } from './retry';

export class RateLimitError extends Error {
  constructor(message = 'Rate limit exceeded: Token bucket exhausted') {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class CircuitBreakerOpenError extends Error {
  constructor(circuitName: string) {
    super(`Circuit breaker '${circuitName}' is OPEN - request rejected to prevent cascade`);
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

export class ResiliencePipeline {
  public readonly name: string;
  public rateLimiter?: TokenBucketRateLimiter;
  public circuitBreaker?: CircuitBreaker;
  public retryPolicy?: Partial<RetryPolicy>;

  constructor(config: ResiliencePipelineConfig) {
    this.name = config.name;
    this.rateLimiter = config.rateLimiter;
    this.circuitBreaker = config.circuitBreaker;
    this.retryPolicy = config.retryPolicy;
  }

  public async execute<T>(
    operation: (attempt: number) => Promise<T>,
    fallback?: (error: Error) => Promise<T> | T
  ): Promise<PipelineExecutionOutcome<T>> {
    const startTime = Date.now();
    const attemptLogs: AttemptLog[] = [];

    // 1. Check Rate Limiter
    if (this.rateLimiter && !this.rateLimiter.tryAcquire(1)) {
      const error = new RateLimitError();
      if (fallback) {
        try {
          const fallbackRes = await fallback(error);
          return {
            status: 'RATE_LIMITED',
            result: fallbackRes,
            attempts: 0,
            totalBackoffDelayMs: 0,
            totalDurationMs: Date.now() - startTime,
            circuitState: this.circuitBreaker ? this.circuitBreaker.getState() : CircuitState.CLOSED,
            remainingTokens: this.rateLimiter.getAvailableTokens(),
            attemptLogs,
          };
        } catch {
          // Fallback failed
        }
      }

      return {
        status: 'RATE_LIMITED',
        error,
        attempts: 0,
        totalBackoffDelayMs: 0,
        totalDurationMs: Date.now() - startTime,
        circuitState: this.circuitBreaker ? this.circuitBreaker.getState() : CircuitState.CLOSED,
        remainingTokens: this.rateLimiter.getAvailableTokens(),
        attemptLogs,
      };
    }

    // 2. Check Circuit Breaker
    if (this.circuitBreaker && this.circuitBreaker.getState() === CircuitState.OPEN) {
      const error = new CircuitBreakerOpenError(this.circuitBreaker.config.name);
      if (fallback) {
        try {
          const fallbackRes = await fallback(error);
          return {
            status: 'CIRCUIT_OPEN',
            result: fallbackRes,
            attempts: 0,
            totalBackoffDelayMs: 0,
            totalDurationMs: Date.now() - startTime,
            circuitState: CircuitState.OPEN,
            remainingTokens: this.rateLimiter ? this.rateLimiter.getAvailableTokens() : -1,
            attemptLogs,
          };
        } catch {
          // Fallback failed
        }
      }

      return {
        status: 'CIRCUIT_OPEN',
        error,
        attempts: 0,
        totalBackoffDelayMs: 0,
        totalDurationMs: Date.now() - startTime,
        circuitState: CircuitState.OPEN,
        remainingTokens: this.rateLimiter ? this.rateLimiter.getAvailableTokens() : -1,
        attemptLogs,
      };
    }

    // 3. Execute through CircuitBreaker + Retry
    const runWithRetry = async () => {
      const policy: RetryPolicy = {
        maxRetries: this.retryPolicy?.maxRetries ?? 2,
        baseDelayMs: this.retryPolicy?.baseDelayMs ?? 50,
        maxDelayMs: this.retryPolicy?.maxDelayMs ?? 1000,
        jitter: this.retryPolicy?.jitter ?? JitterStrategy.FULL,
        retryableErrors: this.retryPolicy?.retryableErrors,
      };

      let totalBackoff = 0;
      let prevDelay = 0;

      for (let attempt = 0; attempt <= policy.maxRetries; attempt++) {
        const attemptStart = Date.now();
        try {
          const result = await operation(attempt);
          const duration = Date.now() - attemptStart;
          attemptLogs.push({ attemptNumber: attempt + 1, durationMs: duration });
          return { result, attempts: attempt + 1, totalBackoffDelayMs: totalBackoff };
        } catch (err) {
          const duration = Date.now() - attemptStart;
          const errorMsg = err instanceof Error ? err.message : String(err);

          if (attempt === policy.maxRetries) {
            attemptLogs.push({ attemptNumber: attempt + 1, durationMs: duration, error: errorMsg });
            throw err;
          }

          if (policy.retryableErrors && !policy.retryableErrors(err)) {
            attemptLogs.push({ attemptNumber: attempt + 1, durationMs: duration, error: errorMsg });
            throw err;
          }

          const delay = RetryExecutor.calculateDelay(attempt, policy, prevDelay);
          prevDelay = delay;
          totalBackoff += delay;

          attemptLogs.push({
            attemptNumber: attempt + 1,
            durationMs: duration,
            error: errorMsg,
            backoffDelayMs: delay,
          });

          await new Promise(r => setTimeout(r, delay));
        }
      }
      throw new Error('Retries exhausted');
    };

    try {
      let executionResult: { result: T; attempts: number; totalBackoffDelayMs: number };

      if (this.circuitBreaker) {
        executionResult = await this.circuitBreaker.execute(() => runWithRetry());
      } else {
        executionResult = await runWithRetry();
      }

      return {
        status: executionResult.attempts > 1 ? 'RETRIED' : 'SUCCESS',
        result: executionResult.result,
        attempts: executionResult.attempts,
        totalBackoffDelayMs: executionResult.totalBackoffDelayMs,
        totalDurationMs: Date.now() - startTime,
        circuitState: this.circuitBreaker ? this.circuitBreaker.getState() : CircuitState.CLOSED,
        remainingTokens: this.rateLimiter ? this.rateLimiter.getAvailableTokens() : -1,
        attemptLogs,
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));

      if (fallback) {
        try {
          const fallbackRes = await fallback(error);
          return {
            status: 'FAILED',
            result: fallbackRes,
            error,
            attempts: attemptLogs.length,
            totalBackoffDelayMs: attemptLogs.reduce((acc, l) => acc + (l.backoffDelayMs ?? 0), 0),
            totalDurationMs: Date.now() - startTime,
            circuitState: this.circuitBreaker ? this.circuitBreaker.getState() : CircuitState.CLOSED,
            remainingTokens: this.rateLimiter ? this.rateLimiter.getAvailableTokens() : -1,
            attemptLogs,
          };
        } catch {
          // Fallback failed
        }
      }

      return {
        status: 'FAILED',
        error,
        attempts: attemptLogs.length,
        totalBackoffDelayMs: attemptLogs.reduce((acc, l) => acc + (l.backoffDelayMs ?? 0), 0),
        totalDurationMs: Date.now() - startTime,
        circuitState: this.circuitBreaker ? this.circuitBreaker.getState() : CircuitState.CLOSED,
        remainingTokens: this.rateLimiter ? this.rateLimiter.getAvailableTokens() : -1,
        attemptLogs,
      };
    }
  }
}
