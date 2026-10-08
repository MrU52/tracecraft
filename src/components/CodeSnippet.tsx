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

  const tabs = [
    ['pipeline', 'ResiliencePipeline'],
    ['circuit', 'CircuitBreaker'],
    ['retry', 'RetryExecutor'],
  ] as const;

  const code = { pipeline: pipelineCode, circuit: circuitCode, retry: retryCode }[tab];

  return (
    <div className="border border-ink bg-card">
      <div className="px-4 py-2.5 border-b border-ink flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold">Using it</h2>
        <div className="flex gap-4 font-mono text-xs">
          {tabs.map(([key, name]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={
                tab === key
                  ? 'underline decoration-signal decoration-2 underline-offset-4'
                  : 'text-ink-faint hover:text-ink'
              }
            >
              {name}
            </button>
          ))}
        </div>
      </div>
      <pre className="p-4 bg-ink text-paper text-xs font-mono leading-relaxed overflow-x-auto">
        <code>{code}</code>
      </pre>
    </div>
  );
};
