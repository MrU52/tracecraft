import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CircuitBreaker, CircuitState } from '../core/resilience/circuit-breaker';

describe('CircuitBreaker Finite State Machine', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({
      name: 'test-breaker',
      slidingWindowSize: 5,
      failureRateThreshold: 50,
      waitDurationInOpenStateMs: 500,
      permittedCallsInHalfOpen: 2,
    });
  });

  it('starts in CLOSED state with 0% failure rate', () => {
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
    const metrics = breaker.getMetrics();
    expect(metrics.state).toBe(CircuitState.CLOSED);
    expect(metrics.failureRatePercent).toBe(0);
    expect(metrics.totalCalls).toBe(0);
  });

  it('remains CLOSED on successful calls', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await breaker.execute(async () => 'ok');
      expect(res).toBe('ok');
    }
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
    expect(breaker.getMetrics().successfulCalls).toBe(5);
  });

  it('trips to OPEN state when failure rate threshold is exceeded', async () => {
    const stateChanges: CircuitState[] = [];
    breaker.onStateChange((from, to) => stateChanges.push(to));

    // Fail 3 out of 5 calls (60% failure rate > 50% threshold)
    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(async () => {
          throw new Error('Downstream boom');
        });
      } catch {
        // Expected
      }
    }

    expect(breaker.getState()).toBe(CircuitState.OPEN);
    expect(stateChanges).toContain(CircuitState.OPEN);
  });

  it('fails fast or invokes fallback when in OPEN state', async () => {
    breaker.forceOpen();

    let fallbackCalled = false;
    const result = await breaker.execute(
      async () => 'primary',
      async () => {
        fallbackCalled = true;
        return 'fallback_value';
      }
    );

    expect(fallbackCalled).toBe(true);
    expect(result).toBe('fallback_value');
    expect(breaker.getMetrics().fallbackCount).toBe(1);
  });

  it('transitions to HALF_OPEN after timeout and recovers to CLOSED if probes succeed', async () => {
    vi.useFakeTimers();

    breaker.forceOpen();
    expect(breaker.getState()).toBe(CircuitState.OPEN);

    // Fast-forward past waitDurationInOpenStateMs (500ms)
    vi.advanceTimersByTime(550);
    expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);

    // Send 2 successful probes (permittedCallsInHalfOpen = 2)
    await breaker.execute(async () => 'probe-1');
    expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);

    await breaker.execute(async () => 'probe-2');
    // Now it should have healed and recovered to CLOSED!
    expect(breaker.getState()).toBe(CircuitState.CLOSED);

    vi.useRealTimers();
  });
});
