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
  { key: 'healthy', name: 'healthy', errorRate: 0, latencyMs: 50 },
  { key: 'flaky', name: 'flaky', errorRate: 0.4, latencyMs: 150 },
  { key: 'outage', name: 'outage', errorRate: 1, latencyMs: 250 },
  { key: 'slow', name: 'slow', errorRate: 0.1, latencyMs: 900 },
] as const;

export const RequestSimulator: React.FC<RequestSimulatorProps> = ({
  config,
  onChangeConfig,
  onSendSingle,
  onSendBurst,
  isAutoTraffic,
  onToggleAutoTraffic,
  isExecuting,
}) => {
  const layers = [
    { key: 'enableRateLimiter', label: 'rate limiter' },
    { key: 'enableCircuitBreaker', label: 'circuit breaker' },
    { key: 'enableRetry', label: 'retry' },
  ] as const;

  return (
    <div className="border border-ink bg-card">
      <div className="px-4 py-2.5 border-b border-ink flex items-center justify-between">
        <h2 className="font-display text-lg font-bold">Fake upstream</h2>
        <span className="label">POST /api/v1/charge</span>
      </div>

      <div className="p-4 space-y-5">
        <div>
          <div className="label mb-1.5">presets</div>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => {
              const active = config.errorRate === p.errorRate && config.latencyMs === p.latencyMs;
              return (
                <button
                  key={p.key}
                  onClick={() => onChangeConfig({ ...config, errorRate: p.errorRate, latencyMs: p.latencyMs })}
                  className={`font-mono text-xs px-2.5 py-1 border ${
                    active ? 'bg-ink text-card border-ink' : 'border-rule hover:border-ink'
                  }`}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <label className="block">
            <div className="flex justify-between font-mono text-xs mb-1">
              <span className="text-ink-soft">errors</span>
              <span>{Math.round(config.errorRate * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={Math.round(config.errorRate * 100)}
              onChange={(e) => onChangeConfig({ ...config, errorRate: Number(e.target.value) / 100 })}
              className="w-full"
            />
          </label>
          <label className="block">
            <div className="flex justify-between font-mono text-xs mb-1">
              <span className="text-ink-soft">latency</span>
              <span>{config.latencyMs}ms</span>
            </div>
            <input
              type="range"
              min="10"
              max="1200"
              step="20"
              value={config.latencyMs}
              onChange={(e) => onChangeConfig({ ...config, latencyMs: Number(e.target.value) })}
              className="w-full"
            />
          </label>
        </div>

        <div>
          <div className="label mb-1.5">layers in the path</div>
          <div className="space-y-1">
            {layers.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 font-mono text-xs cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={config[key]}
                  onChange={(e) => onChangeConfig({ ...config, [key]: e.target.checked })}
                  className="accent-signal"
                />
                <span className={config[key] ? '' : 'text-ink-faint'}>{label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            onClick={onSendSingle}
            disabled={isExecuting}
            className="font-mono text-xs px-3.5 py-2 bg-signal text-card hover:bg-ink transition-colors disabled:opacity-50"
          >
            {isExecuting ? 'sending…' : 'send one'}
          </button>
          <button
            onClick={() => onSendBurst(10)}
            className="font-mono text-xs px-3.5 py-2 border border-ink hover:bg-ink hover:text-card transition-colors"
          >
            burst x10
          </button>
          <button
            onClick={onToggleAutoTraffic}
            className={`font-mono text-xs px-3.5 py-2 border border-ink transition-colors ${
              isAutoTraffic ? 'bg-ink text-card' : 'hover:bg-ink hover:text-card'
            }`}
          >
            {isAutoTraffic ? 'stop traffic' : 'auto traffic'}
          </button>
        </div>
      </div>
    </div>
  );
};
