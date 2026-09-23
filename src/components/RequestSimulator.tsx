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

export const RequestSimulator: React.FC<RequestSimulatorProps> = ({
  config,
  onChangeConfig,
  onSendSingle,
  onSendBurst,
  isAutoTraffic,
  onToggleAutoTraffic,
  isExecuting,
}) => {
  const applyPreset = (preset: 'healthy' | 'flaky' | 'outage' | 'slow') => {
    switch (preset) {
      case 'healthy':
        onChangeConfig({ ...config, errorRate: 0, latencyMs: 50 });
        break;
      case 'flaky':
        onChangeConfig({ ...config, errorRate: 0.4, latencyMs: 150 });
        break;
      case 'outage':
        onChangeConfig({ ...config, errorRate: 1.0, latencyMs: 250 });
        break;
      case 'slow':
        onChangeConfig({ ...config, errorRate: 0.1, latencyMs: 900 });
        break;
    }
  };

  return (
    <div className="glass-panel rounded-xl p-5 border border-surface-border">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-surface-border/50">
        <div>
          <h2 className="text-sm font-bold font-mono text-white tracking-tight uppercase">
            Upstream Target Simulator
          </h2>
          <p className="text-xs text-slate-400">
            Simulates an external HTTP service under real network conditions
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 text-[11px] font-mono text-primary-400 border border-slate-700">
          <span className="w-2 h-2 rounded-full bg-primary-400 animate-pulse" />
          <span>POST /api/v1/charge</span>
        </div>
      </div>

      {/* Quick Presets */}
      <div className="mb-5">
        <label className="text-xs font-mono text-slate-400 uppercase tracking-wider block mb-2">
          Scenario Presets
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            onClick={() => applyPreset('healthy')}
            className={`px-3 py-2 rounded-lg text-xs font-mono border transition-all text-left ${
              config.errorRate === 0 && config.latencyMs <= 100
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                : 'bg-surface-elevated hover:bg-slate-700/60 text-slate-300 border-surface-border'
            }`}
          >
            <div className="font-semibold text-emerald-400">Normal Health</div>
            <div className="text-[10px] text-slate-400">0% err &bull; 50ms</div>
          </button>

          <button
            onClick={() => applyPreset('flaky')}
            className={`px-3 py-2 rounded-lg text-xs font-mono border transition-all text-left ${
              config.errorRate === 0.4
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                : 'bg-surface-elevated hover:bg-slate-700/60 text-slate-300 border-surface-border'
            }`}
          >
            <div className="font-semibold text-amber-400">Flaky Network</div>
            <div className="text-[10px] text-slate-400">40% err &bull; 150ms</div>
          </button>

          <button
            onClick={() => applyPreset('outage')}
            className={`px-3 py-2 rounded-lg text-xs font-mono border transition-all text-left ${
              config.errorRate === 1.0
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                : 'bg-surface-elevated hover:bg-slate-700/60 text-slate-300 border-surface-border'
            }`}
          >
            <div className="font-semibold text-rose-400">Total Outage</div>
            <div className="text-[10px] text-slate-400">100% err &bull; 503</div>
          </button>

          <button
            onClick={() => applyPreset('slow')}
            className={`px-3 py-2 rounded-lg text-xs font-mono border transition-all text-left ${
              config.latencyMs >= 800
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                : 'bg-surface-elevated hover:bg-slate-700/60 text-slate-300 border-surface-border'
            }`}
          >
            <div className="font-semibold text-cyan-400">High Latency</div>
            <div className="text-[10px] text-slate-400">10% err &bull; 900ms</div>
          </button>
        </div>
      </div>

      {/* Sliders */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        <div>
          <div className="flex justify-between text-xs font-mono mb-1.5">
            <span className="text-slate-400">Simulated Error Rate:</span>
            <span className="text-white font-bold">{Math.round(config.errorRate * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={Math.round(config.errorRate * 100)}
            onChange={(e) =>
              onChangeConfig({ ...config, errorRate: Number(e.target.value) / 100 })
            }
            className="w-full accent-primary-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
          />
        </div>

        <div>
          <div className="flex justify-between text-xs font-mono mb-1.5">
            <span className="text-slate-400">Simulated Latency:</span>
            <span className="text-white font-bold">{config.latencyMs}ms</span>
          </div>
          <input
            type="range"
            min="10"
            max="1200"
            step="20"
            value={config.latencyMs}
            onChange={(e) =>
              onChangeConfig({ ...config, latencyMs: Number(e.target.value) })
            }
            className="w-full accent-primary-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
          />
        </div>
      </div>

      {/* Resilience Layer Checkboxes */}
      <div className="mb-5 p-3 rounded-lg bg-surface-elevated/50 border border-surface-border">
        <label className="text-xs font-mono text-slate-400 uppercase tracking-wider block mb-2">
          Active Defense Layers
        </label>
        <div className="flex flex-wrap gap-4 text-xs font-mono">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={config.enableRateLimiter}
              onChange={(e) =>
                onChangeConfig({ ...config, enableRateLimiter: e.target.checked })
              }
              className="accent-primary-500 rounded"
            />
            <span className={config.enableRateLimiter ? 'text-white' : 'text-slate-500 line-through'}>
              Token Bucket Rate Limiter
            </span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={config.enableCircuitBreaker}
              onChange={(e) =>
                onChangeConfig({ ...config, enableCircuitBreaker: e.target.checked })
              }
              className="accent-primary-500 rounded"
            />
            <span className={config.enableCircuitBreaker ? 'text-white' : 'text-slate-500 line-through'}>
              Circuit Breaker (50% trip)
            </span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={config.enableRetry}
              onChange={(e) =>
                onChangeConfig({ ...config, enableRetry: e.target.checked })
              }
              className="accent-primary-500 rounded"
            />
            <span className={config.enableRetry ? 'text-white' : 'text-slate-500 line-through'}>
              Retry (Exponential + Jitter)
            </span>
          </label>
        </div>
      </div>

      {/* Trigger Buttons */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={onSendSingle}
          disabled={isExecuting}
          className="flex-1 py-2.5 px-4 rounded-lg bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 text-white font-mono text-xs font-bold shadow-lg shadow-primary-500/20 active:scale-95 transition-all disabled:opacity-50"
        >
          {isExecuting ? 'Transmitting...' : 'Send 1 Request'}
        </button>

        <button
          onClick={() => onSendBurst(10)}
          disabled={isExecuting}
          className="py-2.5 px-4 rounded-lg bg-surface-elevated hover:bg-slate-700 text-slate-200 border border-surface-border font-mono text-xs font-medium active:scale-95 transition-all disabled:opacity-50"
        >
          Burst 10 Reqs (Test Limiter)
        </button>

        <button
          onClick={onToggleAutoTraffic}
          className={`py-2.5 px-4 rounded-lg font-mono text-xs font-medium border transition-all flex items-center gap-2 ${
            isAutoTraffic
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              : 'bg-surface-elevated hover:bg-slate-700 text-slate-400 border-surface-border'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isAutoTraffic ? 'bg-emerald-400 animate-ping' : 'bg-slate-600'
            }`}
          />
          {isAutoTraffic ? 'Streaming Traffic (1 req/s)' : 'Auto-Traffic'}
        </button>
      </div>
    </div>
  );
};
