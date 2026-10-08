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

const Gauge: React.FC<{ n: string; title: string; note: string; children: React.ReactNode }> = ({ n, title, note, children }) => (
  <div className="p-5 flex flex-col">
    <div className="cap flex justify-between mb-3">
      <span>
        <span className="text-blue">{n}</span> {title}
      </span>
    </div>
    <div className="flex-1">{children}</div>
    <p className="text-[13px] leading-snug text-mute mt-4">{note}</p>
  </div>
);

const Pair: React.FC<{ k: string; v: React.ReactNode }> = ({ k, v }) => (
  <div>
    <span className="cap text-mute">{k} </span>
    <span className="num text-sm font-medium">{v}</span>
  </div>
);

const STATES = [CircuitState.CLOSED, CircuitState.OPEN, CircuitState.HALF_OPEN];

export const ResilienceCards: React.FC<ResilienceCardsProps> = ({
  circuitMetrics,
  tokenStats,
  retryStats,
  onForceTrip,
  onForceClose,
  onResetBreaker,
}) => {
  const whole = Math.floor(tokenStats.availableTokens);
  const small = 'cap px-2 py-1 border-2 border-ink hover:bg-ink hover:text-white transition-colors';

  return (
    <section className="bg-white border-2 border-ink grid grid-cols-1 md:grid-cols-3 divide-y-2 md:divide-y-0 md:divide-x-2 divide-ink">
      <Gauge
        n="01"
        title="rate limiter"
        note={`Burst of ${tokenStats.capacity}, then ${tokenStats.refillRatePerSec} a second. Refill is worked out lazily from the clock.`}
      >
        <div className="flex items-baseline gap-2">
          <span className="num text-7xl font-medium leading-none">{whole}</span>
          <span className="num text-mute">/{tokenStats.capacity}</span>
        </div>
        <div className="flex gap-[3px] mt-4" aria-hidden>
          {Array.from({ length: tokenStats.capacity }, (_, i) => (
            <span key={i} className={`h-4 flex-1 border-2 border-ink ${i < whole ? 'bg-ink' : ''}`} />
          ))}
        </div>
        <div className="flex gap-5 mt-3">
          <Pair k="passed" v={tokenStats.totalAccepted} />
          <Pair k="429" v={<span className="text-blue">{tokenStats.totalRejected}</span>} />
        </div>
      </Gauge>

      <Gauge
        n="02"
        title="circuit breaker"
        note="Open means calls fail on the spot instead of waiting on a dead service. After the cooldown a couple of probes go through."
      >
        <div className="text-5xl font-black uppercase leading-none [font-stretch:70%]">
          {circuitMetrics.state.replace('_', '-')}
        </div>
        <div className="grid grid-cols-3 mt-4 border-2 border-ink" aria-hidden>
          {STATES.map((s) => (
            <span
              key={s}
              className={`cap text-center py-1 border-r-2 last:border-r-0 border-ink ${
                s === circuitMetrics.state ? 'bg-ink text-white' : 'text-mute'
              }`}
            >
              {s === CircuitState.HALF_OPEN ? 'half' : s.toLowerCase()}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3">
          <Pair k="failing" v={`${circuitMetrics.failureRatePercent}% / 50%`} />
          <Pair k="trips" v={circuitMetrics.trippedCount} />
          <Pair k="short-circuited" v={circuitMetrics.fallbackCount} />
        </div>
        <div className="flex gap-1.5 mt-3">
          <button onClick={onForceTrip} className={small}>force open</button>
          <button onClick={onForceClose} className={small}>force close</button>
          <button onClick={onResetBreaker} className={small}>reset all</button>
        </div>
      </Gauge>

      <Gauge
        n="03"
        title="retry"
        note="Wait random(0, base x 2^attempt) between tries so a crowd of clients doesn't come back all at once."
      >
        <div className="flex items-baseline gap-2">
          <span className="num text-7xl font-medium leading-none">{retryStats.successfulRetries}</span>
          <span className="cap text-mute">calls saved by a retry</span>
        </div>
        <div className="flex gap-5 mt-4">
          <Pair k="retries fired" v={retryStats.totalRetries} />
          <Pair k="max tries" v="3" />
        </div>
      </Gauge>
    </section>
  );
};
