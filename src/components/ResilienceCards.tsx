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

export const ResilienceCards: React.FC<ResilienceCardsProps> = ({
  circuitMetrics,
  tokenStats,
  retryStats,
  onForceTrip,
  onForceClose,
  onResetBreaker,
}) => {
  const isClosed = circuitMetrics.state === CircuitState.CLOSED;
  const isOpen = circuitMetrics.state === CircuitState.OPEN;
  const isHalfOpen = circuitMetrics.state === CircuitState.HALF_OPEN;

  const tokenPercent = Math.min(100, Math.max(0, (tokenStats.availableTokens / tokenStats.capacity) * 100));

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* 1. Token Bucket Rate Limiter */}
      <div className="glass-panel rounded-xl p-5 border border-surface-border flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono font-medium text-slate-400 uppercase tracking-wider">
              Layer 1: Rate Limiter
            </span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-primary-500/10 text-primary-400 border border-primary-500/20">
              Token Bucket
            </span>
          </div>

          <div className="flex items-baseline justify-between mb-2">
            <div className="text-2xl font-bold font-mono text-white">
              {Math.floor(tokenStats.availableTokens)} <span className="text-xs text-slate-400 font-normal">/ {tokenStats.capacity} tokens</span>
            </div>
            <div className="text-xs font-mono text-slate-400">
              +{tokenStats.refillRatePerSec}/sec
            </div>
          </div>

          {/* Token Bucket visual capacity bar */}
          <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden mb-4 border border-slate-700">
            <div
              className={`h-full transition-all duration-300 ${
                tokenPercent > 50
                  ? 'bg-accent-emerald'
                  : tokenPercent > 20
                  ? 'bg-accent-amber'
                  : 'bg-accent-rose'
              }`}
              style={{ width: `${tokenPercent}%` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="bg-surface-elevated/70 p-2 rounded border border-surface-border/50">
              <div className="text-slate-400 text-[10px]">ACCEPTED</div>
              <div className="text-emerald-400 font-semibold text-sm">{tokenStats.totalAccepted}</div>
            </div>
            <div className="bg-surface-elevated/70 p-2 rounded border border-surface-border/50">
              <div className="text-slate-400 text-[10px]">THROTTLED (429)</div>
              <div className="text-rose-400 font-semibold text-sm">{tokenStats.totalRejected}</div>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-surface-border/40 text-[11px] text-slate-400 font-sans">
          Continuous time refill: allows burst of up to {tokenStats.capacity} reqs, then throttles to {tokenStats.refillRatePerSec} req/s.
        </div>
      </div>

      {/* 2. Circuit Breaker FSM */}
      <div className="glass-panel rounded-xl p-5 border border-surface-border flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono font-medium text-slate-400 uppercase tracking-wider">
              Layer 2: Circuit Breaker
            </span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              Finite State Machine
            </span>
          </div>

          {/* FSM State Badge */}
          <div className="flex items-center justify-between mb-4">
            <div
              className={`px-3 py-1.5 rounded-lg font-mono font-bold text-sm tracking-wider flex items-center gap-2 border ${
                isClosed
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : isOpen
                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/30 animate-pulse'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isClosed ? 'bg-emerald-400' : isOpen ? 'bg-rose-400' : 'bg-amber-400'
                }`}
              />
              {circuitMetrics.state}
            </div>

            <div className="text-right">
              <div className="text-[10px] text-slate-400 font-mono">ERROR RATE</div>
              <div
                className={`text-sm font-bold font-mono ${
                  circuitMetrics.failureRatePercent >= 50 ? 'text-rose-400' : 'text-slate-200'
                }`}
              >
                {circuitMetrics.failureRatePercent}% <span className="text-xs font-normal text-slate-400">/ 50%</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono mb-3">
            <div className="bg-surface-elevated/70 p-1.5 rounded border border-surface-border/50">
              <div className="text-slate-400 text-[9px]">TOTAL</div>
              <div className="text-white font-semibold">{circuitMetrics.totalCalls}</div>
            </div>
            <div className="bg-surface-elevated/70 p-1.5 rounded border border-surface-border/50">
              <div className="text-slate-400 text-[9px]">TRIPPED</div>
              <div className="text-rose-400 font-semibold">{circuitMetrics.trippedCount}</div>
            </div>
            <div className="bg-surface-elevated/70 p-1.5 rounded border border-surface-border/50">
              <div className="text-slate-400 text-[9px]">FAST FAILS</div>
              <div className="text-amber-400 font-semibold">{circuitMetrics.fallbackCount}</div>
            </div>
          </div>

          {/* Quick FSM controls */}
          <div className="flex gap-2">
            <button
              onClick={onForceTrip}
              className="flex-1 py-1 px-2 rounded bg-rose-950/40 hover:bg-rose-900/50 border border-rose-800/40 text-[11px] font-mono text-rose-300 transition-colors"
            >
              Force Open
            </button>
            <button
              onClick={onForceClose}
              className="flex-1 py-1 px-2 rounded bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-800/40 text-[11px] font-mono text-emerald-300 transition-colors"
            >
              Force Close
            </button>
            <button
              onClick={onResetBreaker}
              className="py-1 px-2.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-mono text-slate-300 transition-colors"
              title="Reset Breaker State"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-surface-border/40 text-[11px] text-slate-400 font-sans">
          Fails fast (0ms) when OPEN to protect downstream servers. Probes with {isHalfOpen ? 'trial calls' : '3 calls'} after 5s cooldown.
        </div>
      </div>

      {/* 3. Exponential Backoff with Jitter */}
      <div className="glass-panel rounded-xl p-5 border border-surface-border flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono font-medium text-slate-400 uppercase tracking-wider">
              Layer 3: Retry Policy
            </span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-primary-500/10 text-primary-400 border border-primary-500/20">
              Full Jitter
            </span>
          </div>

          <div className="flex items-baseline justify-between mb-3">
            <div className="text-2xl font-bold font-mono text-white">
              {retryStats.successfulRetries} <span className="text-xs text-slate-400 font-normal">healed</span>
            </div>
            <div className="text-xs font-mono text-slate-400">
              {retryStats.totalRetries} retries triggered
            </div>
          </div>

          <div className="bg-surface-elevated/70 p-3 rounded-lg border border-surface-border/50 text-xs font-mono mb-3 space-y-1.5">
            <div className="flex justify-between text-slate-300">
              <span className="text-slate-400">Max Retries:</span>
              <span className="font-semibold text-white">3 attempts</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span className="text-slate-400">Base Delay:</span>
              <span>100ms (multiplier 2x)</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span className="text-slate-400">Jitter Formula:</span>
              <span className="text-accent-emerald text-[11px]">rand(0, base * 2^attempt)</span>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-surface-border/40 text-[11px] text-slate-400 font-sans">
          Randomized delay prevents the <strong>Thundering Herd</strong> problem by desynchronizing client retry spikes.
        </div>
      </div>
    </div>
  );
};
