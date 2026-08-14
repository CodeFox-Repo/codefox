import type { LintFinding } from './lint-artifact';

/**
 * The page's design findings, as context for the next turn.
 *
 * The linter runs at the END of a turn, so the agent that wrote the slop
 * never sees the verdict — the findings went to the user's Changes panel and
 * stopped there. Nothing carried them back, so the same page came back with
 * the same purple gradient every turn, and the only way to fix one was for
 * the user to read the panel and retype it themselves.
 *
 * This is the return path. The findings are recomputed from the page at the
 * start of each turn rather than stored: a restyle, a restore or a hand edit
 * all change what is true, and a remembered list would describe a page that
 * no longer exists.
 *
 * ponytail: recomputed, not persisted — no column, no migration, and the
 * answer is never stale.
 */

/** P2 is advice. It is not worth prompt budget on every turn. */
const CARRIED = new Set(['P0', 'P1']);

/**
 * Enough to correct a page, bounded so a badly-linting page cannot crowd out
 * the thing the user actually asked for. The linter emits at most one finding
 * per rule, so this only bites on a page failing most of them at once.
 */
export const LINT_NOTE_LIMIT = 8;

export function lintNote(findings?: LintFinding[] | null): string {
  const carried = (findings ?? [])
    .filter((f) => CARRIED.has(f.severity))
    .slice(0, LINT_NOTE_LIMIT);
  if (!carried.length) return '';

  const lines = carried.map(
    (f) =>
      `- [${f.severity}] ${f.message}\n  Fix: ${f.fix}` +
      (f.snippet ? `\n  Found: ${f.snippet}` : ''),
  );

  return (
    `A design linter checked this page after the last turn and flagged:\n${lines.join('\n')}\n\n` +
    // The linter is greppy by design and says so in its own header, so the
    // agent is told to verify rather than obey. A finding it "fixes" without
    // looking is how a deliberate design choice gets undone every turn.
    'These are advisory. Check each against the file before changing anything — ' +
    'the linter matches patterns, not intent, so a finding can be wrong about a ' +
    'deliberate choice. Fix the ones that are right while you are in the file, ' +
    'but the message below is the actual request: do not let this list derail it.\n\n---\n\n'
  );
}
