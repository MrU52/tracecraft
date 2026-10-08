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

const VERDICT: Record<string, string> = {
  SUCCESS: '200',
  RETRIED: '200',
  RATE_LIMITED: '429',
  CIRCUIT_OPEN: 'OPEN',
  FAILED: '500',
};

const Swatch: React.FC<{ kind: 'ok' | 'bad' | 'wait' | 'rej'; label: string }> = ({ kind, label }) => (
  <span className="flex items-center gap-1.5">
    {kind === 'ok' && <span className="w-5 h-3 bg-ink" />}
    {kind === 'bad' && <span className="w-5 h-3 hatch" />}
    {kind === 'wait' && <span className="w-5 border-t-2 border-dashed border-ink" />}
    {kind === 'rej' && <span className="w-2 h-3 bg-blue" />}
    {label}
  </span>
);

// One row of the waterfall: attempts are bars, backoff waits are dashed gaps.
const Track: React.FC<{ record: RequestRecord; axisMs: number }> = ({ record, axisMs }) => {
  const { outcome } = record;
  const pct = (ms: number) => `${Math.max(0.4, (ms / axisMs) * 100)}%`;

  if (outcome.attemptLogs.length === 0) {
    return <span className="inline-block w-2 h-4 bg-blue" title="rejected before reaching the upstream" />;
  }

  return (
    <div className="flex items-center h-4">
      {outcome.attemptLogs.map((log, i) => (
        <React.Fragment key={i}>
          <span
            className={`h-4 shrink-0 ${log.error ? 'hatch' : 'bg-ink'}`}
            style={{ width: pct(log.durationMs) }}
            title={`attempt ${log.attemptNumber}: ${log.durationMs}ms${log.error ? ` (${log.error})` : ''}`}
          />
          {log.backoffDelayMs !== undefined && (
            <span
              className="shrink-0 border-t-2 border-dashed border-ink"
              style={{ width: pct(log.backoffDelayMs) }}
              title={`waited ${log.backoffDelayMs}ms`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export const ExecutionLog: React.FC<ExecutionLogProps> = ({ records, onClear }) => {
  const [openId, setOpenId] = useState<string | null>(null);
  const axisMs = Math.max(400, ...records.map((r) => r.outcome.totalDurationMs));

  return (
    <section className="bg-white border-2 border-ink">
      <div className="px-4 py-3 border-b-2 border-ink flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <h2 className="text-2xl font-black uppercase leading-none [font-stretch:70%]">Requests</h2>
        <div className="cap flex flex-wrap items-center gap-x-4 gap-y-1">
          <Swatch kind="ok" label="attempt ok" />
          <Swatch kind="bad" label="attempt failed" />
          <Swatch kind="wait" label="backoff" />
          <Swatch kind="rej" label="turned away" />
          <button onClick={onClear} className="text-mute hover:text-blue underline underline-offset-4">
            clear
          </button>
        </div>
      </div>

      {records.length === 0 ? (
        <p className="px-4 py-12 cap text-mute text-center">no requests yet</p>
      ) : (
        <ul className="max-h-[460px] overflow-y-auto divide-y divide-ink/15">
          {records.map((rec) => {
            const { outcome } = rec;
            const rejected = outcome.attemptLogs.length === 0;
            const open = openId === rec.id;
            return (
              <li key={rec.id} data-row>
                <button
                  onClick={() => setOpenId(open ? null : rec.id)}
                  className="w-full grid grid-cols-[76px_1fr_92px] sm:grid-cols-[96px_1fr_112px] items-center gap-3 px-4 py-2 text-left hover:bg-page/60"
                >
                  <span className="num text-xs text-mute">{rec.timestamp.slice(0, 8)}</span>
                  <Track record={rec} axisMs={axisMs} />
                  <span className="num text-xs text-right">
                    <span className={`font-semibold ${rejected ? 'text-blue' : ''}`}>{VERDICT[outcome.status]}</span>
                    {outcome.status === 'RETRIED' && <span className="text-mute"> x{outcome.attempts}</span>}
                    <span className="text-mute"> {outcome.totalDurationMs}ms</span>
                  </span>
                </button>

                {open && (
                  <div className="px-4 pb-3 pt-1 num text-xs text-mute space-y-1 bg-page/40">
                    <p>
                      {rec.id} · {outcome.status.toLowerCase().replace('_', ' ')} · breaker {outcome.circuitState.toLowerCase()} ·{' '}
                      {outcome.remainingTokens >= 0 ? `${outcome.remainingTokens} tokens left` : 'limiter off'}
                    </p>
                    {rejected && <p className="text-ink">Never left the client, so nothing to draw.</p>}
                    {outcome.attemptLogs.map((log) => (
                      <p key={log.attemptNumber} className="text-ink">
                        #{log.attemptNumber} {log.durationMs}ms {log.error ?? 'ok'}
                        {log.backoffDelayMs !== undefined && <span className="text-mute"> → waited {log.backoffDelayMs}ms</span>}
                      </p>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
