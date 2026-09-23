import React, { useState } from 'react';
import { PipelineExecutionOutcome } from '../core/resilience/pipeline';

export interface RequestRecord {
  id: string;
  timestamp: string;
  endpoint: string;
  outcome: PipelineExecutionOutcome<{ status: string; id: string }>;
}

interface ExecutionLogProps {
  records: RequestRecord[];
  onClear: () => void;
}

export const ExecutionLog: React.FC<ExecutionLogProps> = ({ records, onClear }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="glass-panel rounded-xl p-5 border border-surface-border">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-surface-border/50">
        <div>
          <h2 className="text-sm font-bold font-mono text-white tracking-tight uppercase">
            Live Execution Feed &amp; Waterfall
          </h2>
          <p className="text-xs text-slate-400">
            Real-time telemetry showing retries, backoff delays, and circuit fast-fails
          </p>
        </div>
        <button
          onClick={onClear}
          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-400 transition-colors border border-slate-700"
        >
          Clear Feed
        </button>
      </div>

      {records.length === 0 ? (
        <div className="text-center py-12 text-slate-500 font-mono text-xs border border-dashed border-slate-800 rounded-lg">
          No requests sent yet. Click &quot;Send 1 Request&quot; or &quot;Burst 10 Reqs&quot; above to watch resilience layers execute.
        </div>
      ) : (
        <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
          {records.map((rec) => {
            const { outcome } = rec;
            const isSuccess = outcome.status === 'SUCCESS';
            const isRetried = outcome.status === 'RETRIED';
            const isRateLimited = outcome.status === 'RATE_LIMITED';
            const isCircuitOpen = outcome.status === 'CIRCUIT_OPEN';
            const isFailed = outcome.status === 'FAILED';

            const isExpanded = expandedId === rec.id;

            return (
              <div
                key={rec.id}
                className="bg-surface-elevated/70 border border-surface-border/60 hover:border-slate-600 rounded-lg p-3 text-xs font-mono transition-all"
              >
                <div
                  className="flex items-center justify-between cursor-pointer select-none"
                  onClick={() => toggleExpand(rec.id)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500 text-[11px]">{rec.timestamp}</span>
                    <span className="text-slate-300 font-semibold">{rec.id}</span>
                    <span className="text-slate-400 text-[11px] hidden sm:inline">{rec.endpoint}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Status Badge */}
                    {isSuccess && (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
                        200 OK
                      </span>
                    )}
                    {isRetried && (
                      <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-bold">
                        200 OK (Retried x{outcome.attempts})
                      </span>
                    )}
                    {isRateLimited && (
                      <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 font-bold">
                        429 Too Many Requests
                      </span>
                    )}
                    {isCircuitOpen && (
                      <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30 font-bold">
                        503 Circuit OPEN (0ms)
                      </span>
                    )}
                    {isFailed && (
                      <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30 font-bold">
                        500 Failed (Exhausted)
                      </span>
                    )}

                    {/* Total Duration */}
                    <span
                      className={`font-semibold ${
                        isCircuitOpen
                          ? 'text-accent-emerald font-bold'
                          : outcome.totalDurationMs > 400
                          ? 'text-amber-400'
                          : 'text-slate-200'
                      }`}
                    >
                      {outcome.totalDurationMs}ms
                    </span>

                    <span className="text-slate-500 text-xs">
                      {isExpanded ? '▲' : '▼'}
                    </span>
                  </div>
                </div>

                {/* Expanded Details / Waterfall Breakdown */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-surface-border/50 text-[11px] space-y-2">
                    {isCircuitOpen && (
                      <div className="p-2 rounded bg-rose-950/20 border border-rose-900/40 text-rose-300">
                        ⚡ <strong>Fast-Fail Protected:</strong> Circuit Breaker intercepted this request in 0ms without contacting downstream server, saving server load and eliminating latency.
                      </div>
                    )}

                    {isRateLimited && (
                      <div className="p-2 rounded bg-amber-950/20 border border-amber-900/40 text-amber-300">
                        🛑 <strong>Rate Limit Throttled:</strong> Token bucket had 0 tokens remaining. Client throttled until tokens refill (+2/s).
                      </div>
                    )}

                    {outcome.attemptLogs.length > 0 && (
                      <div>
                        <div className="text-slate-400 font-semibold mb-1.5 uppercase tracking-wider text-[10px]">
                          Attempt Breakdown:
                        </div>
                        <div className="space-y-1 pl-2 border-l-2 border-primary-500/40">
                          {outcome.attemptLogs.map((log, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-slate-300">
                              <span className="text-primary-400 font-bold">#{log.attemptNumber}</span>
                              <span>Duration: {log.durationMs}ms</span>
                              {log.error ? (
                                <span className="text-rose-400 font-mono">({log.error})</span>
                              ) : (
                                <span className="text-emerald-400 font-mono">(&#x2713; HTTP 200 OK)</span>
                              )}
                              {log.backoffDelayMs !== undefined && (
                                <span className="text-cyan-400 font-mono text-[10px]">
                                  &rarr; Exponential Backoff Jitter: {log.backoffDelayMs}ms
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-4 text-slate-400 pt-1 text-[10px]">
                      <span>Attempts: {outcome.attempts}</span>
                      <span>Total Backoff: {outcome.totalBackoffDelayMs}ms</span>
                      <span>Circuit State: {outcome.circuitState}</span>
                      <span>Remaining Tokens: {outcome.remainingTokens >= 0 ? outcome.remainingTokens : 'N/A'}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
