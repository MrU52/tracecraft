import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CircuitBreaker, CircuitState } from '../core/resilience/circuit-breaker';

const boom = async () => {
  throw new Error('boom');
};

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({
      name: 'test',
      slidingWindowSize: 5,
      failureRateThreshold: 50,
      waitDurationInOpenStateMs: 500,
      permittedCallsInHalfOpen: 2,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts closed with nothing recorded', () => {
    const m = breaker.getMetrics();
    expect(m.state).toBe(CircuitState.CLOSED);
    expect(m.failureRatePercent).toBe(0);
    expect(m.totalCalls).toBe(0);
  });

  it('stays closed while calls succeed', async () => {
    for (let i = 0; i < 5; i++) {
      expect(await breaker.execute(async () => 'ok')).toBe('ok');
    }
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
    expect(breaker.getMetrics().successfulCalls).toBe(5);
  });

  it('opens once the failure rate passes the threshold', async () => {
    const seen: CircuitState[] = [];
    breaker.onStateChange((_from, to) => seen.push(to));

    for (let i = 0; i < 3; i++) {
      await breaker.execute(boom).catch(() => {});
    }

    expect(breaker.getState()).toBe(CircuitState.OPEN);
    expect(seen).toEqual([CircuitState.OPEN]);
  });

  it('does not judge on fewer than three samples', async () => {
    await breaker.execute(boom).catch(() => {});
    await breaker.execute(boom).catch(() => {});
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
  });

  it('uses the fallback instead of calling through when open', async () => {
    breaker.forceOpen();
    const action = vi.fn(async () => 'primary');

    const result = await breaker.execute(action, () => 'fallback');

    expect(result).toBe('fallback');
    expect(action).not.toHaveBeenCalled();
    expect(breaker.getMetrics().fallbackCount).toBe(1);
  });

  it('throws when open and there is no fallback', async () => {
    breaker.forceOpen();
    await expect(breaker.execute(async () => 'x')).rejects.toThrow(/OPEN/);
  });

  it('goes half-open after the wait and closes again once enough probes pass', async () => {
    vi.useFakeTimers();
    breaker.forceOpen();

    vi.advanceTimersByTime(550);
    expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);

    await breaker.execute(async () => 'probe');
    expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);
    await breaker.execute(async () => 'probe');
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
  });

  it('reopens if a probe fails', async () => {
    vi.useFakeTimers();
    breaker.forceOpen();
    vi.advanceTimersByTime(550);

    await breaker.execute(boom).catch(() => {});

    expect(breaker.getState()).toBe(CircuitState.OPEN);
    expect(breaker.getMetrics().trippedCount).toBe(2);
  });

  it('turns away extra callers while probes are in flight', async () => {
    vi.useFakeTimers();
    breaker.forceOpen();
    vi.advanceTimersByTime(550);

    const never = new Promise<string>(() => {});
    void breaker.execute(() => never);
    void breaker.execute(() => never);

    await expect(breaker.execute(async () => 'third')).rejects.toThrow(/probing limit/);
  });
});
