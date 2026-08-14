/**
 * Record the project's design system in NOTES.md.
 *
 * Only restyle needs this. The planner's question card already answers
 * through a real agent turn, and the agent's own instructions tell it to
 * record decisions in NOTES.md — writing those from the backend too is the
 * double-write that produces duplicate and conflicting lines. Restyle is the
 * one design decision that never runs a turn: it is a GraphQL mutation that
 * swaps the token block and returns, so nothing ever told the agent the look
 * had changed, and the next turn was still building against the old one.
 *
 * REPLACES its own line rather than appending — NOTES.md is clipped into
 * every prompt, so an append-only log of every style the user tried would
 * crowd out the decisions that still matter.
 */

/** The one line this owns. Matched case-insensitively so a line the agent
 *  reworded in its own pass is still recognised as this decision. */
const STYLE_LINE = /^-\s*design system:.*$/im;

const line = (name: string) => `- Design system: ${name}`;

/**
 * `notes` is the file as it stands, or null when there is none yet.
 *
 * Returns the new contents. Keeping this a pure string function is what lets
 * the check exercise every shape without a workspace or a database.
 */
export function noteStyle(notes: string | null, systemName: string): string {
  const next = line(systemName);
  const existing = notes?.trim();

  // A project whose agent has not written notes yet: create the same shape
  // the instructions describe, so the agent's own later edits fit in.
  if (!existing) return `# Notes\n${next}\n`;

  // Already recorded — rewrite in place, keeping surrounding decisions.
  if (STYLE_LINE.test(existing)) {
    return `${existing.replace(STYLE_LINE, next)}\n`;
  }

  return `${existing}\n${next}\n`;
}
