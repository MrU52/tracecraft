import React from 'react';

interface InterviewGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InterviewGuideModal: React.FC<InterviewGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface border border-surface-border rounded-xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border bg-surface-elevated/50">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span className="text-accent-emerald">&#x25C6;</span>
              Interview Talking Points &amp; Technical Defense
            </h3>
            <p className="text-xs text-slate-400">
              How to explain this project with 100% confidence to engineering interviewers
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700 transition-colors"
          >
            &#x2715;
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-300 font-sans">
          {/* Question 1 */}
          <div className="space-y-2 border-b border-surface-border/40 pb-5">
            <h4 className="font-semibold text-white text-sm flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-primary-500/20 text-primary-400 text-xs font-mono font-bold">
                Q1
              </span>
              &quot;Why did you build this project?&quot;
            </h4>
            <p className="text-xs leading-relaxed text-slate-300">
              <strong>Your Answer:</strong> &quot;In school, we studied algorithms, finite state machines, and data structures in theory. I wanted to see how those exact concepts solve real-world backend reliability problems. I built TraceCraft to implement the three essential network resilience patterns—Token Bucket rate limiting, a 3-state Circuit Breaker, and Exponential Backoff retries with full jitter—from scratch in TypeScript with zero external dependencies.&quot;
            </p>
          </div>

          {/* Question 2 */}
          <div className="space-y-2 border-b border-surface-border/40 pb-5">
            <h4 className="font-semibold text-white text-sm flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-primary-500/20 text-primary-400 text-xs font-mono font-bold">
                Q2
              </span>
              &quot;Why do you add jitter to Exponential Backoff?&quot;
            </h4>
            <p className="text-xs leading-relaxed text-slate-300">
              <strong>Your Answer:</strong> &quot;Without jitter, if a downstream payment API drops and 1,000 clients fail simultaneously, all 1,000 will wait exactly 1 second, then retry at the exact same millisecond. This causes a massive spike that immediately crashes the recovering server again—known as the <strong>Thundering Herd</strong> problem. By introducing full jitter (<code>sleep = rand(0, base * 2^attempt)</code>), retries are uniformly randomized across time, smoothing the recovery curve.&quot;
            </p>
          </div>

          {/* Question 3 */}
          <div className="space-y-2 border-b border-surface-border/40 pb-5">
            <h4 className="font-semibold text-white text-sm flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-primary-500/20 text-primary-400 text-xs font-mono font-bold">
                Q3
              </span>
              &quot;How does the Circuit Breaker work under the hood?&quot;
            </h4>
            <p className="text-xs leading-relaxed text-slate-300">
              <strong>Your Answer:</strong> &quot;It&apos;s a three-state Finite State Machine: <code>CLOSED</code>, <code>OPEN</code>, and <code>HALF_OPEN</code>. In <code>CLOSED</code>, calls pass through and outcomes are tracked in a sliding window. If the failure rate exceeds 50%, it trips to <code>OPEN</code>. In <code>OPEN</code>, requests fail fast in 0ms without hitting the network, saving thread pools and latency. After a 5-second cooldown, it enters <code>HALF_OPEN</code>, sending probe requests. If probes succeed, it heals to <code>CLOSED</code>; if any probe fails, it trips back to <code>OPEN</code>.&quot;
            </p>
          </div>

          {/* Question 4 */}
          <div className="space-y-2 border-b border-surface-border/40 pb-5">
            <h4 className="font-semibold text-white text-sm flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-primary-500/20 text-primary-400 text-xs font-mono font-bold">
                Q4
              </span>
              &quot;Why Token Bucket instead of a fixed time window for Rate Limiting?&quot;
            </h4>
            <p className="text-xs leading-relaxed text-slate-300">
              <strong>Your Answer:</strong> &quot;Fixed time windows suffer from boundary spikes—a client can send 10 requests at the very end of minute 1 and 10 requests at the start of minute 2, delivering 20 requests in 1 second. Token Bucket eliminates this: tokens refill continuously based on elapsed timestamp delta (<code>(now - lastRefill) * rate</code>). It allows natural traffic bursts up to bucket capacity while strictly enforcing the long-term throughput ceiling.&quot;
            </p>
          </div>

          {/* Question 5 */}
          <div className="space-y-2">
            <h4 className="font-semibold text-white text-sm flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-primary-500/20 text-primary-400 text-xs font-mono font-bold">
                Q5
              </span>
              &quot;How do you test it?&quot;
            </h4>
            <p className="text-xs leading-relaxed text-slate-300">
              <strong>Your Answer:</strong> &quot;I wrote unit test suites with Vitest using fake timers to test state transitions deterministically. I also built this interactive web simulator to test edge cases visually: testing bursts to watch token bucket exhaustion, and simulating downstream outages to verify the circuit trips and heals.&quot;
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-surface-border bg-surface-elevated/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 text-white font-mono text-xs font-semibold transition-colors"
          >
            Got It, Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
