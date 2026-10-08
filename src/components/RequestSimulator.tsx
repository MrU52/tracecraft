import React from 'react';

export interface SimulatorConfig {
  errorRate: number;      // 0 to 1
  latencyMs: number;      // 10 to 1500
  enableRateLimiter: boolean;
  enableCircuitBreaker: boolean;
  enableRetry: boolean;
}

interface RequestSimulatorProps {
  config: SimulatorConfig;
  onChangeConfig: (newConfig: SimulatorConfig) => void;
  onSendSingle: () => void;
  onSendBurst: (count: number) => void;
  isAutoTraffic: boolean;
  onToggleAutoTraffic: () => void;
  isExecuting: boolean;
}

const PRESETS = [
  { name: 'healthy', errorRate: 0, latencyMs: 50 },
  { name: 'flaky', errorRate: 0.4, latencyMs: 150 },
  { name: 'outage', errorRate: 1, latencyMs: 250 },
  { name: 'slow', errorRate: 0.1, latencyMs: 900 },
] as const;

const LAYERS = [
  { key: 'enableRateLimiter', label: 'limiter' },
  { key: 'enableCircuitBreaker', label: 'breaker' },
  { key: 'enableRetry', label: 'retry' },
] as const;

const Cell: React.FC<{ title: string; className?: string; children: React.ReactNode }> = ({ title, className = '', children }) => (
  <div className={`p-4 ${className}`}>
    <div className="cap text-mute mb-2">{title}</div>
    {children}
  </div>
);

export const RequestSimulator: React.FC<RequestSimulatorProps> = ({
  config,
  onChangeConfig,
  onSendSingle,
  onSendBurst,
  isAutoTraffic,
  onToggleAutoTraffic,
  isExecuting,
}) => {
  const btn = 'cap px-3 py-2 border-2 border-ink hover:bg-ink hover:text-white transition-colors';

  return (
    <section className="bg-white border-2 border-ink grid grid-cols-1 md:grid-cols-12 divide-y-2 md:divide-y-0 md:divide-x-2 divide-ink">
      <Cell title="fake upstream" className="md:col-span-3">
        <div className="grid grid-cols-2 gap-1.5">
          {PRESETS.map((p) => {
            const active = config.errorRate === p.errorRate && config.latencyMs === p.latencyMs;
            return (
              <button
                key={p.name}
                onClick={() => onChangeConfig({ ...config, errorRate: p.errorRate, latencyMs: p.latencyMs })}
                className={`cap py-1.5 border-2 border-ink ${active ? 'bg-ink text-white' : 'hover:bg-ink/10'}`}
              >
                {p.name}
              </button>
            );
          })}
        </div>
      </Cell>

      <Cell title={`errors ${Math.round(config.errorRate * 100)}%`} className="md:col-span-2">
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={Math.round(config.errorRate * 100)}
          onChange={(e) => onChangeConfig({ ...config, errorRate: Number(e.target.value) / 100 })}
          className="w-full"
          aria-label="error rate"
        />
        <div className="cap text-mute mt-4 mb-2">latency {config.latencyMs}ms</div>
        <input
          type="range"
          min="10"
          max="1200"
          step="20"
          value={config.latencyMs}
          onChange={(e) => onChangeConfig({ ...config, latencyMs: Number(e.target.value) })}
          className="w-full"
          aria-label="latency"
        />
      </Cell>

      <Cell title="in the path" className="md:col-span-2">
        <div className="space-y-1.5">
          {LAYERS.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={config[key]}
                onChange={(e) => onChangeConfig({ ...config, [key]: e.target.checked })}
                className="peer sr-only"
              />
              <span className="w-4 h-4 border-2 border-ink peer-checked:bg-blue peer-checked:border-blue peer-focus-visible:outline outline-2 outline-offset-2" />
              <span className={`cap ${config[key] ? '' : 'text-mute line-through'}`}>{label}</span>
            </label>
          ))}
        </div>
      </Cell>

      <Cell title="send" className="md:col-span-5">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onSendSingle}
            disabled={isExecuting}
            className="cap px-4 py-2 bg-blue text-white border-2 border-blue hover:bg-ink hover:border-ink transition-colors disabled:opacity-50"
          >
            one request
          </button>
          <button onClick={() => onSendBurst(10)} className={btn}>
            burst x10
          </button>
          <button onClick={onToggleAutoTraffic} className={`${btn} ${isAutoTraffic ? 'bg-ink text-white' : ''}`}>
            {isAutoTraffic ? 'stop stream' : 'stream 1/s'}
          </button>
        </div>
      </Cell>
    </section>
  );
};
