import React from 'react';

export const Header: React.FC<{ requestCount: number }> = ({ requestCount }) => {
  return (
    <header className="border-b border-ink">
      <div className="max-w-6xl mx-auto px-5 pt-8 pb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden>
              <path d="M2 18h7l4-11 5 18 4-11h8" fill="none" stroke="#d9421c" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <h1 className="font-display text-4xl font-bold leading-none tracking-tight">tracecraft</h1>
          </div>
          <p className="mt-2 text-sm text-ink-soft max-w-md">
            A rate limiter, a circuit breaker and a retry loop, written from scratch.
            Break the fake upstream on purpose and watch what each one does.
          </p>
        </div>
        <div className="flex items-center gap-5 font-mono text-xs text-ink-soft">
          <span>{requestCount} in log</span>
          <a
            href="https://github.com/MrU52/tracecraft"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-signal decoration-2 underline-offset-4 hover:text-signal"
          >
            source
          </a>
        </div>
      </div>
    </header>
  );
};
