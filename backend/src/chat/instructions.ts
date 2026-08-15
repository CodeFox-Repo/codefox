/**
 * What the agent is told, assembled per project.
 *
 * Its own module so a test can read the shipped prompt without loading the
 * harness — project-agent.ts imports ESM-only packages jest cannot require.
 */
import { DESIGN_SYSTEMS } from '../project/design-systems';
import { scenario } from '../project/scenarios';
import { lintNote } from './lint-note';
import type { LintFinding } from './lint-artifact';

const HTML_INSTRUCTIONS = `You are CodeFox, building self-contained HTML pages.

The working directory holds a handful of .html files — index.html is the
page. Edit them in place. Everything stays in the HTML files: Tailwind via
the CDN script tag that is already there, inline <script> for behavior. No
package.json, no build step, no framework — if a page needs more structure,
add another .html file and link to it.

index.html carries a design system in its <style> :root block — colors,
type scale, radii, spacing, motion. That block is the page's style
contract. Build against the variables (var(--accent), var(--surface),
var(--text-3xl), var(--radius-md)) instead of picking your own colors,
fonts or sizes, and give every new page you add the same :root block so
the site stays one design. Change a token's VALUE only when the user asks
for a different look — then change it in :root, where it restyles
everything at once, never by hardcoding a hex somewhere in the markup.


`;

const STYLE_SECTION = `When the look is what is open — the user asks for a restyle, or the brief
leaves the visual direction unsaid — the style question is NOT free text. It
carries "kind":"style" and its options are design system ids, verbatim, from
the list at the end of this paragraph. The UI renders each as a palette
swatch; an option that is not an id from that list is dropped from the card
and the user sees nothing. Offer 3 to 5 that contrast with each other, never
the whole list. Exactly this shape, ids included:

\`\`\`codefox-questions
{"intro":"One sentence saying what you understood.","questions":[{"id":"style","kind":"style","label":"Pick a direction","multi":false,"options":["editorial","brutalist","neon","cal"]}]}
\`\`\`

Words like "clean", "modern" or "sleek" are NOT valid options — they are not
ids and the card drops them. The ids, and nothing else, are: ${DESIGN_SYSTEMS.map((s) => s.id).join(', ')}.`;

const NOTES_SECTION = `Keep NOTES.md in the project root as its memory. Only the last 20 turns
are replayed to you, so anything decided before that is gone unless it is
written down. When the user states a decision, a preference, a constraint or
a fact about their product — the audience, a name, a rule like "no pricing
section", a brand colour they insisted on — append a one-line bullet to
NOTES.md. Correct or delete a line when it stops being true. Keep it short;
it is read back to you in full on every turn, and a long file crowds out the
work. Do not log what you did — the git history already has that. Record only
what you would need to know if you had never seen this conversation. It
looks like this, and nothing more elaborate:

# Notes
- Audience: solo founders evaluating on a phone
- Brand accent stays #c96a3a — the user rejected blue twice
- No pricing section until they have real numbers
- Always pnpm, never npm`;

const INSTRUCTIONS = `You are CodeFox, building a Next.js 15 + Tailwind + shadcn/ui app.

The working directory already contains a scaffolded project. Edit it in place.
The main page is src/app/page.tsx.

Plan before you build. On the first message of a project, when the request
leaves real product choices open — audience, tone, pages, content, data —
do not build yet. Reply with ONLY a question block, no other prose and no
file edits, so the UI can render the choices:

\`\`\`codefox-questions
{"intro":"One sentence saying what you understood.","questions":[{"id":"style","label":"Question text","multi":false,"options":["Option A","Option B"]}]}
\`\`\`

2 to 4 questions, 2 to 5 short options each, "multi": true when several can
apply at once. Write the intro, questions and options in the user's language.
Ask at most once per project: when a message answers your questions, or the
request is already specific enough to act on, build without asking again.

Match the conventions already in the project — read a file before rewriting it,
and reuse the components that are already there instead of adding new ones.
Finish with a short summary of what you changed.`;

const PLAN_SECTION = INSTRUCTIONS.slice(
  INSTRUCTIONS.indexOf('Plan before you build.'),
  INSTRUCTIONS.indexOf('Match the conventions'),
);

/** Exported so a test can read what actually ships for a turn. */
export const instructionsFor = (
  template?: string | null,
  scenarioId?: string | null,
): string => {
  // The scenario's guidance rides every turn, whichever kind of project it
  // is. It used to be html-only: the app guidance (the database helper, the
  // component library) was written, tested for presence, and never shipped
  // to the model — a next project's prompt said nothing about either.
  const shape = scenarioId ? scenario(scenarioId).guidance : '';
  if (template !== 'html') {
    return [INSTRUCTIONS, shape, NOTES_SECTION].filter(Boolean).join('\n\n');
  }
  // STYLE_SECTION after PLAN_SECTION, not before: PLAN_SECTION carries its
  // own question example using `"id":"style"` with free-text options, and a
  // model copies the nearest example. Ordered the other way the style rules
  // were stated first and then contradicted by a concrete sample — which is
  // exactly what shipped ("clean"/"sleek" instead of catalog ids).
  return [
    HTML_INSTRUCTIONS,
    shape,
    PLAN_SECTION,
    STYLE_SECTION,
    NOTES_SECTION,
    'Finish with a short summary of what you changed.',
  ]
    .filter(Boolean)
    .join('\n');
};

/**
 * The project's own notes, ahead of the replayed turns.
 *
 * The replay window is the last 20 turns — anything decided before that is
 * gone, and a long project forgets the constraints it was given on turn one.
 * NOTES.md is where the agent writes those down; this reads them back.
 */
export const notesNote = (notes?: string | null): string =>
  notes?.trim()
    ? `What this project has already decided (from NOTES.md):\n\n${notes.trim()}\n\n---\n\n`
    : '';

/**
 * NOTES.md as it rides into a prompt: capped, and SAYING it was capped.
 *
 * It lands in every turn, so an unbounded file quietly eats the context the
 * work needs. Truncating silently is worse than truncating — the agent would
 * believe it had the whole memory and confidently contradict the part it
 * never saw. The note tells it to go read the file.
 */
export const NOTES_LIMIT = 4000;

export function clipNotes(notes?: string | null): string | null {
  if (!notes?.trim()) return null;
  if (notes.length <= NOTES_LIMIT) return notes;
  return `${notes.slice(0, NOTES_LIMIT)}\n\n[NOTES.md is longer than this — the rest was cut. Read the file if you need it, and shorten it.]`;
}

/** One earlier turn, oldest first. */
export interface PriorTurn {
  role: string;
  content: string;
}

/** How much of the conversation to replay, and how much of each turn. */
export const HISTORY_TURNS = 20;
const HISTORY_CHARS = 2000;

/**
 * Retell the conversation so far.
 *
 * Every turn gets a brand-new agent session, so without this the agent saw
 * only the sentence just typed: told a preference in one message it answered
 * "Unknown" when asked about it in the next, and a follow-up like "make it
 * bigger" had no referent at all.
 *
 * Replayed as text rather than resumed through the harness on purpose — a
 * resumable session lives in a bridge process that does not survive a deploy,
 * and this server redeploys constantly.
 */
export const retell = (history: PriorTurn[]): string => {
  const recent = history.slice(-HISTORY_TURNS);
  if (recent.length === 0) return '';

  const lines = recent.map((turn) => {
    const who = /assistant/i.test(turn.role) ? 'Assistant' : 'User';
    const said =
      turn.content.length > HISTORY_CHARS
        ? `${turn.content.slice(0, HISTORY_CHARS)}…`
        : turn.content;
    return `${who}: ${said}`;
  });

  return `Earlier in this conversation:\n\n${lines.join('\n\n')}\n\n---\n\n`;
};

/** Enough to point the agent at the work; a rewrite of 200 files is noise. */
const HAND_EDIT_FILES = 20;

/**
 * Tell the agent what the user changed by hand since the last turn.
 *
 * Without it the agent works from the project as it remembers it and
 * cheerfully rewrites a file the user just fixed themselves — the edits are
 * on disk, but nothing pointed at them, so nothing read them.
 *
 * Paths and statuses rather than a diff: the agent has read tools and the
 * files are right there, so naming them is enough to make it look, and a
 * large hand edit cannot crowd out the actual request.
 *
 * Prompt-only by design. This never becomes a message, so the chat shows the
 * conversation the user had rather than bookkeeping addressed to the model.
 */
export const handEditNote = (
  edits: { path: string; status: string }[],
): string => {
  if (!edits.length) return '';
  const lines = edits
    .slice(0, HAND_EDIT_FILES)
    .map((edit) => `- ${edit.path} (${edit.status} by the user)`);
  const more = edits.length - lines.length;
  return (
    `The user edited these files themselves since your last turn:\n${lines.join('\n')}` +
    `${more > 0 ? `\n- …and ${more} more` : ''}\n\n` +
    'Read them before you change anything, and keep what they did unless ' +
    'this message asks you to undo it.\n\n---\n\n'
  );
};

/**
 * The prompt, from its parts. THE definition — project-agent calls this to
 * build what ships, and the turn-record test calls it to rebuild a recorded
 * prompt from its stored halves and check the hash still matches.
 *
 * Here rather than in project-agent.ts for the reason that module's docblock
 * gives: project-agent imports ESM-only harness packages jest cannot require,
 * so nothing under test can load it. Two copies of this assembly is exactly
 * the drift that would make a recorded promptHash describe a prompt that
 * never ran.
 *
 * `asked` is the user's message plus any attachment lines — image staging
 * needs a sandbox, so it stays on the caller's side.
 */
export const assemblePrompt = ({
  notes,
  history,
  handEdits,
  lint,
  asked,
}: {
  notes?: string | null;
  history?: PriorTurn[];
  handEdits?: { path: string; status: string }[];
  lint?: LintFinding[] | null;
  asked: string;
}): string =>
  // Lint findings sit last of the context blocks, immediately before the ask:
  // they are about the page as it is right now, and the request is what has
  // to stay loudest.
  `${notesNote(notes)}${retell(history ?? [])}${handEditNote(handEdits ?? [])}${lintNote(lint)}${asked}`;
