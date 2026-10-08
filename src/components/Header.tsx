import React from 'react';

export const Header: React.FC<{ requestCount: number }> = ({ requestCount }) => {
  return (
    <header className="bg-ink text-white">
      <div className="max-w-6xl mx-auto px-5 py-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <h1 className="text-6xl sm:text-7xl font-black uppercase leading-[0.85] tracking-tight [font-stretch:68%]">
          trace<span className="text-blue">craft</span>
        </h1>
        <div className="cap text-right text-white/70 leading-relaxed">
          <p>rate limiter / circuit breaker / retry</p>
          <p>
            {requestCount} requests logged ·{' '}
            <a href="https://github.com/MrU52/tracecraft" target="_blank" rel="noreferrer" className="text-white underline underline-offset-4 hover:text-blue">
              source
            </a>
          </p>
        </div>
      </div>
    </header>
  );
};
