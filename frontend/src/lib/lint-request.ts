import type { LintFinding } from '@/api/ChatStreamAPI';

/**
 * The findings on screen, as a message the user is sending.
 *
 * The panel showed what was wrong and offered no way to act on it — reading
 * "swap the purple gradient for a flat surface" and then retyping it into the
 * composer is work the product can do. This composes that turn.
 *
 * It reads as the user's own request rather than a machine payload because
 * that is what it becomes: a normal turn, in the history, undoable like any
 * other. The agent also gets the same findings as prompt context, so this is
 * the instruction to act on them rather than the findings themselves.
 */
export function fixLintMessage(findings: LintFinding[]): string {
  const lines = findings.map((f) => `- ${f.message} ${f.fix}`);
  return (
    `Fix the design issues the linter flagged on this page:\n${lines.join('\n')}\n\n` +
    // Without this a "fix" turn happily rewrites the copy and the layout too,
    // and the user loses work they never asked to change.
    'Change only what these need — leave the content and the layout alone.'
  );
}
