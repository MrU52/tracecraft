import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CircuitBreaker, CircuitBreakerMetrics } from './core/resilience/circuit-breaker';
import { TokenBucketRateLimiter } from './core/resilience/rate-limiter';
import { ResiliencePipeline } from './core/resilience/pipeline';
import { JitterStrategy } from './core/resilience/retry';

import { Header } from './components/Header';
import { ResilienceCards } from './components/ResilienceCards';
import { RequestSimulator, SimulatorConfig } from './components/RequestSimulator';
import { ExecutionLog, RequestRecord } from './components/ExecutionLog';
import { CodeSnippet } from './components/CodeSnippet';

export function App() {
  const circuitBreakerRef = useRef<CircuitBreaker>(
    new CircuitBreaker({
      name: 'payment-gateway',
      slidingWindowSize: 6,
      failureRateThreshold: 50,
      waitDurationInOpenStateMs: 5000,
      permittedCallsInHalfOpen: 2,
    })
  );

  const rateLimiterRef = useRef<TokenBucketRateLimiter>(
    new TokenBucketRateLimiter({
      capacity: 10,
      refillRatePerSec: 2,
    })
  );

  const cb = circuitBreakerRef.current;
  const limiter = rateLimiterRef.current;

  const [simConfig, setSimConfig] = useState<SimulatorConfig>({
    errorRate: 0.35,
    latencyMs: 120,
    enableRateLimiter: true,
    enableCircuitBreaker: true,
    enableRetry: true,
  });

  const [circuitMetrics, setCircuitMetrics] = useState<CircuitBreakerMetrics>(() => cb.getMetrics());
  const [tokenStats, setTokenStats] = useState(() => limiter.getStats());
  const [retryStats, setRetryStats] = useState({ totalRetries: 0, successfulRetries: 0 });
  const [records, setRecords] = useState<RequestRecord[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isAutoTraffic, setIsAutoTraffic] = useState(false);

  // poll so the token bar and the open -> half-open timer move without a request
  useEffect(() => {
    const timer = setInterval(() => {
      setCircuitMetrics(cb.getMetrics());
      setTokenStats(limiter.getStats());
    }, 250);

    return () => clearInterval(timer);
  }, [cb, limiter]);

  const executeRequest = useCallback(async () => {
    setIsExecuting(true);

    const pipeline = new ResiliencePipeline({
      name: 'payment-service',
      rateLimiter: simConfig.enableRateLimiter ? limiter : undefined,
      circuitBreaker: simConfig.enableCircuitBreaker ? cb : undefined,
      retryPolicy: {
        maxRetries: simConfig.enableRetry ? 3 : 0,
        baseDelayMs: 80,
        maxDelayMs: 1000,
        jitter: JitterStrategy.FULL,
      },
    });

    const reqId = `req_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');

    const outcome = await pipeline.execute(
      async (attempt: number) => {
        await new Promise((r) => setTimeout(r, simConfig.latencyMs));

        if (Math.random() < simConfig.errorRate) {
          throw new Error('HTTP 503');
        }

        return {
          status: 'SUCCESS',
          id: `tx_${Math.random().toString(36).slice(2, 8)}`,
        };
      },
      (error) => {
        return {
          status: 'FALLBACK',
          id: `fallback_${Math.random().toString(36).slice(2, 8)}`,
        };
      }
    );

    if (outcome.attempts > 1) {
      setRetryStats((prev) => ({
        totalRetries: prev.totalRetries + (outcome.attempts - 1),
        successfulRetries: outcome.status === 'RETRIED' ? prev.successfulRetries + 1 : prev.successfulRetries,
      }));
    }

    const newRecord: RequestRecord = {
      id: reqId,
      timestamp: timeStr,
      endpoint: '/api/v1/charge',
      outcome,
    };

    setRecords((prev) => [newRecord, ...prev.slice(0, 49)]);
    setCircuitMetrics(cb.getMetrics());
    setTokenStats(limiter.getStats());
    setIsExecuting(false);
  }, [cb, limiter, simConfig]);

  const handleSendBurst = async (count: number) => {
    for (let i = 0; i < count; i++) {
      executeRequest();
      // small stagger so they don't all land in the same millisecond
      await new Promise((r) => setTimeout(r, 20));
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isAutoTraffic) {
      interval = setInterval(() => {
        executeRequest();
      }, 800);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isAutoTraffic, executeRequest]);

  const handleForceTrip = () => {
    cb.forceOpen();
    setCircuitMetrics(cb.getMetrics());
  };

  const handleForceClose = () => {
    cb.forceClose();
    setCircuitMetrics(cb.getMetrics());
  };

  const handleResetBreaker = () => {
    cb.reset();
    limiter.reset();
    setCircuitMetrics(cb.getMetrics());
    setTokenStats(limiter.getStats());
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header requestCount={records.length} />

      <main className="flex-1 max-w-6xl w-full mx-auto px-5 py-8 space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] gap-8">
          <ResilienceCards
            circuitMetrics={circuitMetrics}
            tokenStats={tokenStats}
            retryStats={retryStats}
            onForceTrip={handleForceTrip}
            onForceClose={handleForceClose}
            onResetBreaker={handleResetBreaker}
          />

          <div className="space-y-6">
            <RequestSimulator
              config={simConfig}
              onChangeConfig={setSimConfig}
              onSendSingle={executeRequest}
              onSendBurst={handleSendBurst}
              isAutoTraffic={isAutoTraffic}
              onToggleAutoTraffic={() => setIsAutoTraffic((prev) => !prev)}
              isExecuting={isExecuting}
            />
            <ExecutionLog records={records} onClear={() => setRecords([])} />
          </div>
        </div>

        <CodeSnippet />
      </main>

      <footer className="border-t border-rule py-5 px-5 font-mono text-xs text-ink-faint">
        <div className="max-w-6xl mx-auto">
          no runtime dependencies in <span className="text-ink-soft">src/core</span>. the UI is react + tailwind.
        </div>
      </footer>
    </div>
  );
}

export default App;
