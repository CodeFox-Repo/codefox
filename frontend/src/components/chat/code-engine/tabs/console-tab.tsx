'use client';

import { useEffect, useRef, useState } from 'react';
import { authenticatedFetch } from '@/lib/authenticatedFetch';

interface LogLine {
  at: number;
  stream: 'out' | 'err';
  text: string;
}

/**
 * Dev-server output for the running preview.
 *
 * Polled rather than streamed: the backend keeps a bounded ring buffer, the
 * tab is only mounted while you are looking at it, and a websocket for a few
 * hundred lines would be more moving parts than the feature is worth.
 */
const ConsoleTab = ({ project }: { project?: { projectPath?: string } }) => {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const projectPath = project?.projectPath;

  useEffect(() => {
    if (!projectPath) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await authenticatedFetch(
          `/api/preview/logs?projectPath=${encodeURIComponent(projectPath)}`
        );
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          setLines(data.lines ?? []);
          setError(null);
        }
      } catch {
        if (!cancelled) setError('Could not reach the dev server.');
      }
    };

    poll();
    const id = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [projectPath]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [lines.length]);

  if (!projectPath) {
    return (
      <p className="p-4 font-mono text-xs text-muted-foreground">
        No project attached to this chat yet.
      </p>
    );
  }

  return (
    <div className="h-full overflow-auto bg-background p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-primary">
          Dev server
        </span>
        <span className="font-mono text-[11px] text-muted-foreground">
          {lines.length} lines
        </span>
      </div>

      {error ? (
        <p className="font-mono text-xs text-destructive">{error}</p>
      ) : lines.length === 0 ? (
        <p className="font-mono text-xs text-muted-foreground">
          Nothing yet — open the Preview tab to start the dev server.
        </p>
      ) : (
        <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed">
          {lines.map((l, i) => (
            <div
              key={`${l.at}-${i}`}
              className={
                l.stream === 'err' ? 'text-destructive' : 'text-foreground/85'
              }
            >
              {l.text}
            </div>
          ))}
        </pre>
      )}
      <div ref={endRef} />
    </div>
  );
};

export default ConsoleTab;
