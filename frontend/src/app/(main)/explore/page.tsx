'use client';

import { useState } from 'react';
import { PublicProjects } from '@/components/root/public-projects';

/**
 * Everything anyone has published, on one wall.
 *
 * The landing page shows six; this is the rest. The backend caps a page at
 * 50 — real pagination (a cursor) does not exist yet, so the wall is the
 * fifty most relevant rather than literally everything.
 */
export default function ExplorePage() {
  const [strategy, setStrategy] = useState<'latest' | 'trending'>('latest');

  return (
    <div className="mx-auto w-full max-w-[1180px] px-5 pb-16 sm:px-10">
      <header className="flex flex-wrap items-end justify-between gap-4 pb-8 pt-10">
        <div>
          <p className="font-mono text-sm tracking-[0.12em] text-primary">
            EXPLORE
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
            Built with CodeFox
          </h1>
          <p className="mt-2 max-w-[52ch] text-pretty text-sm leading-relaxed text-muted-foreground">
            Every public project, made by one prompt each. Open any of them — or
            remix one into your own workspace and start from there.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Ordering"
          className="flex rounded-lg border border-border bg-secondary p-1"
        >
          {(
            [
              ['latest', 'Latest'],
              ['trending', 'Most remixed'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              role="tab"
              aria-selected={strategy === value}
              onClick={() => setStrategy(value)}
              className={`rounded-md px-3 py-1.5 font-mono text-xs transition-colors ${
                strategy === value
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <PublicProjects limit={50} strategy={strategy} showHeader={false} />
    </div>
  );
}
