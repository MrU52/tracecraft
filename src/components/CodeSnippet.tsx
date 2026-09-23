import React, { useState } from 'react';

export const CodeSnippet: React.FC = () => {
  const [tab, setTab] = useState<'pipeline' | 'circuit' | 'retry'>('pipeline');

  const pipelineCode = `import { ResiliencePipeline, CircuitBreaker, TokenBucketRateLimiter } from 'tracecraft';

// 1. Configure the pipeline with the 3 resilience layers
const pipeline = new ResiliencePipeline({
  name: 'payment-gateway',
  rateLimiter: new TokenBucketRateLimiter({ capacity: 10, refillRatePerSec: 2 }),
  circuitBreaker: new CircuitBreaker({ name: 'stripe', failureRateThreshold: 50 }),
  retryPolicy: { maxRetries: 3, baseDelayMs: 100 },
});

// 2. Wrap your external HTTP call
const response = await pipeline.execute(
  async () => {
    return await fetch('https://api.stripe.com/v1/charges', { method: 'POST' });
  },
  // Graceful fallback if downstream fails or circuit is OPEN
  (error) => {
    return { status: 'queued_offline', message: error.message };
  }
);`;

  const circuitCode = `import { CircuitBreaker, CircuitState } from 'tracecraft';

const breaker = new CircuitBreaker({
  name: 'postgres-db',
  slidingWindowSize: 10,
  failureRateThreshold: 50,       // Trip when >=50% fail
  waitDurationInOpenStateMs: 5000, // Probe after 5 seconds
});

// Listen to state transitions (CLOSED -> OPEN -> HALF_OPEN -> CLOSED)
breaker.onStateChange((from, to, name) => {
  console.log(\`Circuit [\${name}] transitioned from \${from} to \${to}\`);
});

const result = await breaker.execute(
  () => db.query('SELECT * FROM users'),
  () => ({ cachedData: true, rows: [] }) // Fallback
);`;

  const retryCode = `import { RetryExecutor, JitterStrategy } from 'tracecraft';

// Executes with Exponential Backoff + Full Jitter
const { result, attempts, totalBackoffDelayMs } = await RetryExecutor.executeWithRetry(
  async (attempt) => {
    return await fetch('https://api.weather.com/data');
  },
  {
    maxRetries: 3,
    baseDelayMs: 100,
    maxDelayMs: 2000,
    jitter: JitterStrategy.FULL,
    // Only retry transient 5xx errors; fail fast on 4xx user errors
    retryableErrors: (err) => err.status >= 500,
  }
);`;

  return (
    <div className="glass-panel rounded-xl p-5 border border-surface-border">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-surface-border/50">
        <div>
          <h2 className="text-sm font-bold font-mono text-white tracking-tight uppercase">
            Developer Integration Example
          </h2>
          <p className="text-xs text-slate-400">
            How to use these modules in any Node.js or TypeScript application
          </p>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => setTab('pipeline')}
            className={`px-3 py-1 rounded text-xs font-mono transition-all ${
              tab === 'pipeline'
                ? 'bg-primary-500/20 text-primary-400 border border-primary-500/40 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ResiliencePipeline
          </button>
          <button
            onClick={() => setTab('circuit')}
            className={`px-3 py-1 rounded text-xs font-mono transition-all ${
              tab === 'circuit'
                ? 'bg-primary-500/20 text-primary-400 border border-primary-500/40 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            CircuitBreaker
          </button>
          <button
            onClick={() => setTab('retry')}
            className={`px-3 py-1 rounded text-xs font-mono transition-all ${
              tab === 'retry'
                ? 'bg-primary-500/20 text-primary-400 border border-primary-500/40 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            RetryExecutor
          </button>
        </div>
      </div>

      <div className="relative">
        <pre className="p-4 rounded-lg bg-surface-elevated/80 border border-surface-border text-xs font-mono text-slate-200 overflow-x-auto leading-relaxed">
          <code>
            {tab === 'pipeline' && pipelineCode}
            {tab === 'circuit' && circuitCode}
            {tab === 'retry' && retryCode}
          </code>
        </pre>
      </div>
    </div>
  );
};
