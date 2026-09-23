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
import { InterviewGuideModal } from './components/InterviewGuideModal';

export function App() {
  // Core resilience instances
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

  // Simulator Configuration
  const [simConfig, setSimConfig] = useState<SimulatorConfig>({
    errorRate: 0.35,
    latencyMs: 120,
    enableRateLimiter: true,
    enableCircuitBreaker: true,
    enableRetry: true,
  });

  // Telemetry States
  const [circuitMetrics, setCircuitMetrics] = useState<CircuitBreakerMetrics>(() => cb.getMetrics());
  const [tokenStats, setTokenStats] = useState(() => limiter.getStats());
  const [retryStats, setRetryStats] = useState({ totalRetries: 0, successfulRetries: 0 });
  const [records, setRecords] = useState<RequestRecord[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isAutoTraffic, setIsAutoTraffic] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // Periodically refresh stats (for continuous token refill and circuit breaker timers)
  useEffect(() => {
    const timer = setInterval(() => {
      setCircuitMetrics(cb.getMetrics());
      setTokenStats(limiter.getStats());
    }, 250);

    return () => clearInterval(timer);
  }, [cb, limiter]);

  // Execute a single simulated request through the resilience pipeline
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
        // Simulated network latency
        await new Promise((r) => setTimeout(r, simConfig.latencyMs));

        // Simulated network/service failure based on slider
        if (Math.random() < simConfig.errorRate) {
          throw new Error('HTTP 503: Gateway Unavailable / Upstream Timeout');
        }

        return {
          status: 'SUCCESS',
          id: `tx_${Math.random().toString(36).slice(2, 8)}`,
        };
      },
      // Graceful Fallback
      (error) => {
        return {
          status: 'FALLBACK',
          id: `fallback_${Math.random().toString(36).slice(2, 8)}`,
        };
      }
    );

    // Update retry stats
    if (outcome.attempts > 1) {
      setRetryStats((prev) => ({
        totalRetries: prev.totalRetries + (outcome.attempts - 1),
        successfulRetries: outcome.status === 'RETRIED' ? prev.successfulRetries + 1 : prev.successfulRetries,
      }));
    }

    // Add to execution log
    const newRecord: RequestRecord = {
      id: reqId,
      timestamp: timeStr,
      endpoint: '/api/v1/charge',
      outcome,
    };

    setRecords((prev) => [newRecord, ...prev.slice(0, 49)]); // keep last 50
    setCircuitMetrics(cb.getMetrics());
    setTokenStats(limiter.getStats());
    setIsExecuting(false);
  }, [cb, limiter, simConfig]);

  // Burst handler
  const handleSendBurst = async (count: number) => {
    for (let i = 0; i < count; i++) {
      executeRequest();
      // tiny stagger so they don't hit the exact same millisecond
      await new Promise((r) => setTimeout(r, 20));
    }
  };

  // Auto-traffic interval
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

  // Circuit Breaker manual actions
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
    <div className="min-h-screen bg-background text-slate-100 flex flex-col font-sans selection:bg-primary-500 selection:text-white">
      {/* Top Header */}
      <Header
        onOpenInterviewGuide={() => setIsGuideOpen(true)}
        requestCount={records.length}
      />

      {/* Main Studio Workbench */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
        {/* Row 1: The 3 Core Resilience Pattern Cards */}
        <ResilienceCards
          circuitMetrics={circuitMetrics}
          tokenStats={tokenStats}
          retryStats={retryStats}
          onForceTrip={handleForceTrip}
          onForceClose={handleForceClose}
          onResetBreaker={handleResetBreaker}
        />

        {/* Row 2: Upstream Simulator & Live Execution Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6">
            <RequestSimulator
              config={simConfig}
              onChangeConfig={setSimConfig}
              onSendSingle={executeRequest}
              onSendBurst={handleSendBurst}
              isAutoTraffic={isAutoTraffic}
              onToggleAutoTraffic={() => setIsAutoTraffic((prev) => !prev)}
              isExecuting={isExecuting}
            />
          </div>

          <div className="lg:col-span-6">
            <ExecutionLog
              records={records}
              onClear={() => setRecords([])}
            />
          </div>
        </div>

        {/* Row 3: Developer Code Snippets */}
        <CodeSnippet />
      </main>

      {/* Footer */}
      <footer className="border-t border-surface-border bg-surface/50 py-6 px-6 mt-12 text-center text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            Pure <strong>TypeScript</strong>, <strong>Zero External Runtime Dependencies</strong>, <strong>React 19</strong>, <strong>Tailwind CSS</strong>, <strong>Vitest</strong>.
          </div>
          <div className="text-slate-400">
            Open-source Software Engineering Portfolio Project by{' '}
            <a
              href="https://github.com/MrU52"
              target="_blank"
              rel="noreferrer"
              className="text-primary-400 hover:underline font-semibold"
            >
              @MrU52
            </a>
          </div>
        </div>
      </footer>

      {/* Interview Prep Guide Modal */}
      <InterviewGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />
    </div>
  );
}

export default App;
