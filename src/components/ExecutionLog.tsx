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

const VERDICT: Record<string, { text: string; tone: string }> = {
  SUCCESS: { text: '200', tone: 'text-ok' },
  RETRIED: { text: '200 after retry', tone: 'text-tide' },
  RATE_LIMITED: { text: '429', tone: 'text-warn' },
  CIRCUIT_OPEN: { text: '503 short-circuit', tone: 'text-signal' },
  FAILED: { text: '500 gave up', tone: 'text-signal' },
};

export const ExecutionLog: React.FC<ExecutionLogProps> = ({ records, onClear }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="border border-ink bg-card">
      <div className="px-4 py-2.5 border-b border-ink flex items-center justify-between">
        <h2 className="font-display text-lg font-bold">Request log</h2>
        <button onClick={onClear} className="label hover:text-signal">
          clear
        </button>
      </div>

      {records.length === 0 ? (
        <p className="px-4 py-10 text-center font-mono text-xs text-ink-faint">
          nothing yet. send a request and it shows up here.
        </p>
      ) : (
        <ul className="max-h-[440px] overflow-y-auto divide-y divide-rule font-mono text-xs">
          {records.map((rec) => {
            const { outcome } = rec;
            const verdict = VERDICT[outcome.status] ?? { text: outcome.status, tone: '' };
            const open = expandedId === rec.id;

            return (
              <li key={rec.id}>
                <button
                  onClick={() => setExpandedId(open ? null : rec.id)}
                  className="w-full grid grid-cols-[88px_1fr_auto_56px] items-center gap-3 px-4 py-2 text-left hover:bg-paper"
                >
                  <span className="text-ink-faint">{rec.timestamp}</span>
                  <span className="truncate">{rec.id}</span>
                  <span className={verdict.tone}>
                    {verdict.text}
                    {outcome.status === 'RETRIED' && ` (x${outcome.attempts})`}
                  </span>
                  <span className="text-right tabular-nums">{outcome.totalDurationMs}ms</span>
                </button>

                {open && (
                  <div className="px-4 pb-3 pt-1 bg-paper/60 space-y-2">
                    {outcome.status === 'CIRCUIT_OPEN' && (
                      <p className="text-ink-soft">Breaker was open, so this never left the client.</p>
                    )}
                    {outcome.status === 'RATE_LIMITED' && (
                      <p className="text-ink-soft">Bucket was empty. Wait for a refill.</p>
                    )}

                    {outcome.attemptLogs.length > 0 && (
                      <ol className="border-l border-ink pl-3 space-y-0.5">
                        {outcome.attemptLogs.map((log, idx) => (
                          <li key={idx}>
                            <span className="text-ink-faint">#{log.attemptNumber}</span>{' '}
                            {log.durationMs}ms{' '}
                            {log.error ? (
                              <span className="text-signal">{log.error}</span>
                            ) : (
                              <span className="text-ok">ok</span>
                            )}
                            {log.backoffDelayMs !== undefined && (
                              <span className="text-tide"> then waited {log.backoffDelayMs}ms</span>
                            )}
                          </li>
                        ))}
                      </ol>
                    )}

                    <p className="text-ink-faint">
                      {outcome.attempts} attempt{outcome.attempts === 1 ? '' : 's'} · {outcome.totalBackoffDelayMs}ms
                      backoff · breaker {outcome.circuitState} ·{' '}
                      {outcome.remainingTokens >= 0 ? `${outcome.remainingTokens} tokens left` : 'limiter off'}
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
