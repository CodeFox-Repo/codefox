/**
 * What a previewed page printed, per project.
 *
 * The Console tab shows dev-server output — which an html project does not
 * have and never will, so for the product's default kind it could only ever
 * say "open the Preview tab to start the dev server" about a server that
 * does not exist. Meanwhile the agent writes inline `<script>`, and when one
 * of those throws there was nowhere to see it.
 *
 * The preview iframe is same-origin, so the page's own console is readable
 * from the parent. It is collected here rather than in React state because
 * the writer (the preview pane) and the reader (the Console tab) are never
 * mounted in the same subtree — and the errors worth seeing usually happen
 * before anyone opens the tab.
 */
export interface PageLogLine {
  at: number;
  stream: 'out' | 'err';
  text: string;
}

/** Bounded: a page in a render loop must not grow this without limit. */
const MAX_LINES = 300;

const byProject = new Map<string, PageLogLine[]>();
const listeners = new Set<() => void>();

export function pageConsole(projectPath: string | undefined): PageLogLine[] {
  return (projectPath && byProject.get(projectPath)) || [];
}

export function clearPageConsole(projectPath: string): void {
  byProject.delete(projectPath);
  listeners.forEach((notify) => notify());
}

export function recordPageLog(
  projectPath: string,
  stream: PageLogLine['stream'],
  text: string
): void {
  const lines = byProject.get(projectPath) ?? [];
  lines.push({ at: Date.now(), stream, text });
  if (lines.length > MAX_LINES) lines.splice(0, lines.length - MAX_LINES);
  byProject.set(projectPath, lines);
  listeners.forEach((notify) => notify());
}

/** Subscribe to any change; returns the unsubscribe. */
export function onPageLog(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const say = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  try {
    return JSON.stringify(value);
  } catch {
    // Circular, or something that throws on inspection. The point is that
    // *something* was logged, so say that rather than drop the line.
    return String(value);
  }
};

/**
 * Forward a previewed page's console and errors into the store.
 *
 * Wrapping the frame's own console rather than listening for events: an
 * uncaught error reaches `onerror`, but a plain `console.log` has no event,
 * and seeing what the page prints is most of why anyone opens this tab.
 */
export function capturePageConsole(
  frame: HTMLIFrameElement,
  projectPath: string
): void {
  const view = frame.contentWindow as any;
  if (!view || view.__codefoxConsoleHooked) return;
  view.__codefoxConsoleHooked = true;

  const native = view.console ?? {};
  for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    const original = native[level];
    native[level] = (...args: unknown[]) => {
      recordPageLog(
        projectPath,
        level === 'error' || level === 'warn' ? 'err' : 'out',
        args.map(say).join(' ')
      );
      // The real console still gets it: devtools remains the fuller view,
      // and swallowing output here would make this tab a downgrade.
      original?.apply?.(native, args);
    };
  }

  view.addEventListener('error', (event: ErrorEvent) => {
    const where = event.lineno ? ` (line ${event.lineno})` : '';
    recordPageLog(projectPath, 'err', `${event.message}${where}`);
  });
  view.addEventListener(
    'unhandledrejection',
    (event: PromiseRejectionEvent) => {
      recordPageLog(
        projectPath,
        'err',
        `Unhandled rejection: ${say(event.reason)}`
      );
    }
  );
}
