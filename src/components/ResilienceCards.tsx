import React from 'react';
import { CircuitState, CircuitBreakerMetrics } from '../core/resilience/circuit-breaker';

interface ResilienceCardsProps {
  circuitMetrics: CircuitBreakerMetrics;
  tokenStats: {
    availableTokens: number;
    capacity: number;
    refillRatePerSec: number;
    totalAccepted: number;
    totalRejected: number;
  };
  retryStats: {
    totalRetries: number;
    successfulRetries: number;
  };
  onForceTrip: () => void;
  onForceClose: () => void;
  onResetBreaker: () => void;
}

const Stage: React.FC<{
  n: number;
  title: string;
  tag: string;
  children: React.ReactNode;
  note: string;
}> = ({ n, title, tag, children, note }) => (
  <section className="relative pl-12 pb-8 last:pb-0">
    <div className="absolute left-0 top-0 w-8 h-8 rounded-full border border-ink bg-card flex items-center justify-center font-mono text-xs">
      {n}
    </div>
    <div className="flex items-baseline justify-between gap-3 border-b border-rule pb-1.5 mb-3">
      <h3 className="font-display text-xl font-bold">{title}</h3>
      <span className="label">{tag}</span>
    </div>
    {children}
    <p className="mt-3 text-[13px] leading-snug text-ink-soft max-w-prose">{note}</p>
  </section>
);

const Figure: React.FC<{ label: string; value: React.ReactNode; tone?: string }> = ({ label, value, tone }) => (
  <div>
    <div className="label">{label}</div>
    <div className={`font-mono text-lg ${tone ?? ''}`}>{value}</div>
  </div>
);

export const ResilienceCards: React.FC<ResilienceCardsProps> = ({
  circuitMetrics,
  tokenStats,
  retryStats,
  onForceTrip,
  onForceClose,
  onResetBreaker,
}) => {
  const state = circuitMetrics.state;
  const tokenPercent = Math.min(100, Math.max(0, (tokenStats.availableTokens / tokenStats.capacity) * 100));

  const stateTone =
    state === CircuitState.CLOSED ? 'text-ok' : state === CircuitState.OPEN ? 'text-signal' : 'text-warn';

  const btn =
    'font-mono text-[11px] px-2.5 py-1 border border-ink hover:bg-ink hover:text-card transition-colors';

  return (
    <div className="relative">
      {/* the spine connecting the three stages */}
      <div className="absolute left-4 top-8 bottom-4 w-px bg-ink/40" aria-hidden />

      <Stage
        n={1}
        title="Rate limiter"
        tag="token bucket"
        note={`Refills continuously, so a burst of ${tokenStats.capacity} goes through and then you're held to ${tokenStats.refillRatePerSec}/s.`}
      >
        <div className="flex items-end gap-6 mb-3">
          <Figure
            label="tokens"
            value={
              <>
                {Math.floor(tokenStats.availableTokens)}
                <span className="text-ink-faint text-sm"> / {tokenStats.capacity}</span>
              </>
            }
          />
          <Figure label="passed" value={tokenStats.totalAccepted} tone="text-ok" />
          <Figure label="429s" value={tokenStats.totalRejected} tone="text-signal" />
        </div>
        <div className="h-3 border border-ink bg-card">
          <div
            className="h-full bg-ink transition-[width] duration-200"
            style={{ width: `${tokenPercent}%` }}
          />
        </div>
      </Stage>

      <Stage
        n={2}
        title="Circuit breaker"
        tag="closed / open / half-open"
        note="When it's open, calls fail instantly instead of waiting on a service that's already down. After the cooldown it lets a couple of probes through."
      >
        <div className="flex flex-wrap items-end gap-6 mb-3">
          <Figure label="state" value={state.replace('_', '-').toLowerCase()} tone={stateTone} />
          <Figure
            label="failure rate"
            value={
              <>
                {circuitMetrics.failureRatePercent}%
                <span className="text-ink-faint text-sm"> / 50%</span>
              </>
            }
          />
          <Figure label="trips" value={circuitMetrics.trippedCount} />
          <Figure label="short-circuited" value={circuitMetrics.fallbackCount} />
        </div>
        <div className="flex gap-2">
          <button onClick={onForceTrip} className={btn}>force open</button>
          <button onClick={onForceClose} className={btn}>force close</button>
          <button onClick={onResetBreaker} className={btn}>reset all</button>
        </div>
      </Stage>

      <Stage
        n={3}
        title="Retry"
        tag="exponential backoff, full jitter"
        note="The delay is random(0, base * 2^attempt). Spreading retries out stops every client hammering the recovering service in the same millisecond."
      >
        <div className="flex gap-6">
          <Figure label="recovered" value={retryStats.successfulRetries} tone="text-ok" />
          <Figure label="retries fired" value={retryStats.totalRetries} />
          <Figure label="max attempts" value="3" />
        </div>
      </Stage>
    </div>
  );
};
