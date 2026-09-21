/**
 * Finite State Machine Circuit Breaker Pattern (Netflix Hystrix / Resilience4j style)
 * Prevents cascading failures across distributed microservices by failing fast and
 * providing graceful degradation fallbacks.
 */

export enum CircuitState {
  CLOSED = 'CLOSED',       // Normal operation: requests pass through
  OPEN = 'OPEN',           // Tripped: requests fail fast or trigger fallback
  HALF_OPEN = 'HALF_OPEN', // Probing: testing downstream service recovery
}

export interface CircuitBreakerConfig {
  name: string;
  slidingWindowSize: number;           // Number of requests in rolling window
  failureRateThreshold: number;        // Percentage (0-100) of failures to trip
  waitDurationInOpenStateMs: number;   // Delay before transitioning from OPEN to HALF_OPEN
  permittedCallsInHalfOpen: number;    // Probes allowed in HALF_OPEN
  slowCallDurationThresholdMs: number; // Latency that counts as a degraded/slow call
}

export interface CircuitBreakerMetrics {
  state: CircuitState;
  failureRatePercent: number;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  slowCalls: number;
  consecutiveFailures: number;
  trippedCount: number;
  fallbackCount: number;
  lastStateChangeTimestamp: number;
  nextProbeTimestamp?: number;
}

export type StateChangeHandler = (from: CircuitState, to: CircuitState, breakerName: string) => void;

interface CallOutcome {
  success: boolean;
  durationMs: number;
  isSlow: boolean;
}

export class CircuitBreaker {
  public readonly config: CircuitBreakerConfig;
  private state: CircuitState = CircuitState.CLOSED;
  private slidingWindow: CallOutcome[] = [];
  private consecutiveFailures = 0;
  private totalCalls = 0;
  private successfulCalls = 0;
  private failedCalls = 0;
  private slowCalls = 0;
  private trippedCount = 0;
  private fallbackCount = 0;
  private lastStateChangeTimestamp: number = Date.now();
  private halfOpenTrialCalls = 0;
  private halfOpenTrialSuccesses = 0;
  private listeners: StateChangeHandler[] = [];

  constructor(config: Partial<CircuitBreakerConfig> & { name: string }) {
    this.config = {
      slidingWindowSize: 10,
      failureRateThreshold: 50, // 50%
      waitDurationInOpenStateMs: 5000,
      permittedCallsInHalfOpen: 3,
      slowCallDurationThresholdMs: 400,
      ...config,
    };
  }

  public getState(): CircuitState {
    this.evaluateStateTransitions();
    return this.state;
  }

  public onStateChange(listener: StateChangeHandler): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Evaluates time-based state transitions (OPEN -> HALF_OPEN timeout)
   */
  private evaluateStateTransitions(): void {
    if (this.state === CircuitState.OPEN) {
      const timeInOpen = Date.now() - this.lastStateChangeTimestamp;
      if (timeInOpen >= this.config.waitDurationInOpenStateMs) {
        this.transitionTo(CircuitState.HALF_OPEN);
      }
    }
  }

  private transitionTo(newState: CircuitState): void {
    if (this.state === newState) return;
    const oldState = this.state;
    this.state = newState;
    this.lastStateChangeTimestamp = Date.now();

    if (newState === CircuitState.OPEN) {
      this.trippedCount++;
    } else if (newState === CircuitState.HALF_OPEN) {
      this.halfOpenTrialCalls = 0;
      this.halfOpenTrialSuccesses = 0;
    } else if (newState === CircuitState.CLOSED) {
      this.slidingWindow = [];
      this.consecutiveFailures = 0;
    }

    // Notify observers
    for (const listener of this.listeners) {
      try {
        listener(oldState, newState, this.config.name);
      } catch (err) {
        console.error('Error in circuit breaker listener', err);
      }
    }
  }

  /**
   * Executes a command through the circuit breaker protection layer.
   * If the circuit is OPEN, immediately executes the fallback or throws CircuitBreakerOpenException.
   */
  public async execute<T>(
    action: () => Promise<T>,
    fallback?: (error?: Error) => Promise<T> | T
  ): Promise<T> {
    this.evaluateStateTransitions();

    if (this.state === CircuitState.OPEN) {
      this.fallbackCount++;
      if (fallback) {
        return fallback(new Error(`Circuit Breaker '${this.config.name}' is OPEN`));
      }
      throw new Error(`CircuitBreaker '${this.config.name}' is OPEN - request rejected`);
    }

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.halfOpenTrialCalls >= this.config.permittedCallsInHalfOpen) {
        // Exceeded trial probe allotment while waiting for results
        if (fallback) {
          this.fallbackCount++;
          return fallback(new Error(`Circuit Breaker '${this.config.name}' is testing in HALF_OPEN`));
        }
        throw new Error(`Circuit Breaker '${this.config.name}' probing limit reached`);
      }
      this.halfOpenTrialCalls++;
    }

    const start = Date.now();
    this.totalCalls++;

    try {
      const result = await action();
      const durationMs = Date.now() - start;
      this.onSuccess(durationMs);
      return result;
    } catch (err) {
      const durationMs = Date.now() - start;
      const error = err instanceof Error ? err : new Error(String(err));
      this.onFailure(durationMs, error);

      if (fallback) {
        this.fallbackCount++;
        return fallback(error);
      }
      throw error;
    }
  }

  private onSuccess(durationMs: number): void {
    this.successfulCalls++;
    this.consecutiveFailures = 0;
    const isSlow = durationMs >= this.config.slowCallDurationThresholdMs;
    if (isSlow) this.slowCalls++;

    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenTrialSuccesses++;
      if (this.halfOpenTrialSuccesses >= this.config.permittedCallsInHalfOpen) {
        // Trial probes passed! Downstream service has healed.
        this.transitionTo(CircuitState.CLOSED);
      }
    } else if (this.state === CircuitState.CLOSED) {
      this.recordOutcome({ success: true, durationMs, isSlow });
    }
  }

  private onFailure(durationMs: number, _error: Error): void {
    this.failedCalls++;
    this.consecutiveFailures++;
    const isSlow = durationMs >= this.config.slowCallDurationThresholdMs;

    if (this.state === CircuitState.HALF_OPEN) {
      // Any probe failure in HALF_OPEN immediately trips back to OPEN
      this.transitionTo(CircuitState.OPEN);
    } else if (this.state === CircuitState.CLOSED) {
      this.recordOutcome({ success: false, durationMs, isSlow });
      this.evaluateFailureThreshold();
    }
  }

  private recordOutcome(outcome: CallOutcome): void {
    this.slidingWindow.push(outcome);
    if (this.slidingWindow.length > this.config.slidingWindowSize) {
      this.slidingWindow.shift();
    }
  }

  private evaluateFailureThreshold(): void {
    if (this.slidingWindow.length < Math.min(3, this.config.slidingWindowSize)) {
      return; // Not enough samples to evaluate statistically
    }

    const failedCount = this.slidingWindow.filter(o => !o.success).length;
    const failureRate = (failedCount / this.slidingWindow.length) * 100;

    if (failureRate >= this.config.failureRateThreshold) {
      this.transitionTo(CircuitState.OPEN);
    }
  }

  public forceOpen(): void {
    this.transitionTo(CircuitState.OPEN);
  }

  public forceClose(): void {
    this.transitionTo(CircuitState.CLOSED);
  }

  public reset(): void {
    this.slidingWindow = [];
    this.consecutiveFailures = 0;
    this.totalCalls = 0;
    this.successfulCalls = 0;
    this.failedCalls = 0;
    this.slowCalls = 0;
    this.trippedCount = 0;
    this.fallbackCount = 0;
    this.transitionTo(CircuitState.CLOSED);
  }

  public getMetrics(): CircuitBreakerMetrics {
    const windowSize = this.slidingWindow.length;
    const failedInWindow = this.slidingWindow.filter(o => !o.success).length;
    const failureRatePercent = windowSize === 0 ? 0 : Number(((failedInWindow / windowSize) * 100).toFixed(1));

    let nextProbeTimestamp: number | undefined;
    if (this.state === CircuitState.OPEN) {
      nextProbeTimestamp = this.lastStateChangeTimestamp + this.config.waitDurationInOpenStateMs;
    }

    return {
      state: this.getState(),
      failureRatePercent,
      totalCalls: this.totalCalls,
      successfulCalls: this.successfulCalls,
      failedCalls: this.failedCalls,
      slowCalls: this.slowCalls,
      consecutiveFailures: this.consecutiveFailures,
      trippedCount: this.trippedCount,
      fallbackCount: this.fallbackCount,
      lastStateChangeTimestamp: this.lastStateChangeTimestamp,
      nextProbeTimestamp,
    };
  }
}
