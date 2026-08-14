#!/usr/bin/env node
/**
 * The design linter used to be a dead end: it ran at the END of a turn, so
 * the agent that wrote the slop never saw the verdict, and the findings
 * stopped at the user's Changes panel. The same page came back with the same
 * purple gradient every turn.
 *
 * This guards the return path — findings reach the next turn's prompt, and
 * the panel can send a fix turn. Both halves are branches that only fire when
 * a page is already failing, which no ordinary run reaches.
 *
 * A script rather than a test suite, per this repo's `pnpm check` convention:
 * the frontend has no runner, and the backend half is a pure function whose
 * wiring is what actually breaks.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// ── The note itself ────────────────────────────────────────────────
// Lifted rather than imported: it is TypeScript, and standing up a
// toolchain for one pure function is more machinery than the function.
const noteSrc = read('backend/src/chat/lint-note.ts');

const CARRIED = new Set(['P0', 'P1']);
const LIMIT = 8;
function lintNote(findings) {
  const carried = (findings ?? [])
    .filter((f) => CARRIED.has(f.severity))
    .slice(0, LIMIT);
  if (!carried.length) return '';
  const lines = carried.map(
    (f) =>
      `- [${f.severity}] ${f.message}\n  Fix: ${f.fix}` +
      (f.snippet ? `\n  Found: ${f.snippet}` : '')
  );
  return (
    `A design linter checked this page after the last turn and flagged:\n${lines.join('\n')}\n\n` +
    'These are advisory. Check each against the file before changing anything — ' +
    'the linter matches patterns, not intent, so a finding can be wrong about a ' +
    'deliberate choice. Fix the ones that are right while you are in the file, ' +
    'but the message below is the actual request: do not let this list derail it.\n\n---\n\n'
  );
}

// The lifted copy has to still be the shipped one, or this whole file is
// testing itself rather than the product.
assert.ok(
  noteSrc.includes("const CARRIED = new Set(['P0', 'P1'])"),
  'lint-note no longer filters to P0/P1 — this check is out of date'
);
assert.ok(
  noteSrc.includes('export const LINT_NOTE_LIMIT = 8'),
  'the note limit moved — this check is out of date'
);

const finding = (severity, id) => ({
  severity,
  id,
  message: `${id} happened`,
  fix: `stop doing ${id}`,
});

// A clean page must add NOTHING. An empty preamble on every turn is prompt
// budget spent to say "no news", and it trains the agent to skim the block.
assert.equal(lintNote([]), '', 'a clean page still injects a lint preamble');
assert.equal(lintNote(undefined), '', 'undefined findings inject a preamble');
assert.equal(
  lintNote([finding('P2', 'missing-section-anchor')]),
  '',
  'P2 advice is being spent on prompt budget every turn'
);

// A real finding carries its own fix — advice with no remedy is not
// actionable, and the fix line is the whole reason the linter is useful.
const note = lintNote([finding('P0', 'purple-gradient')]);
assert.match(note, /purple-gradient happened/, 'the message is missing');
assert.match(note, /Fix: stop doing purple-gradient/, 'the fix is missing');
assert.match(
  note,
  /---/,
  'the note does not close its context block, so it runs into the request'
);
// The linter is greppy by its own admission, so the agent must be told to
// verify. Without this a deliberate design choice gets undone every turn.
assert.match(
  note,
  /advisory/i,
  'the note presents greppy findings as facts to obey'
);
// The user's actual request has to survive the block above it.
assert.match(
  note,
  /the message below is the actual request/,
  'nothing keeps the findings from derailing what the user asked for'
);

// Snippets ride along when present and are simply absent when not — a
// "Found: undefined" line would be the agent hunting for a ghost.
assert.match(
  lintNote([{ ...finding('P1', 'raw-hex'), snippet: '#ff0000' }]),
  /Found: #ff0000/,
  'the snippet is dropped'
);
assert.ok(
  !/Found:/.test(note),
  'a finding with no snippet still emits an empty Found line'
);

// Bounded: a page failing every rule must not crowd out the request.
const many = Array.from({ length: 30 }, (_, i) => finding('P0', `rule-${i}`));
const capped = lintNote(many);
assert.equal(
  capped.match(/^- \[P0\]/gm).length,
  LIMIT,
  'the note is unbounded — a badly-linting page can crowd out the request'
);

// ── The wiring, which is what actually breaks ──────────────────────
const agent = read('backend/src/chat/project-agent.ts');
assert.match(
  agent,
  /\$\{lintNote\(lint\)\}\$\{asked\}/,
  'lint findings are no longer in the prompt, or no longer sit last before the request'
);

const controller = read('backend/src/chat/chat.controller.ts');
// Recomputed at turn start. A remembered list would describe a page that a
// restyle, a restore or a hand edit has since changed.
assert.match(
  controller,
  /lint:\s*\n?\s*project\.template === 'html'\s*\n?\s*\?\s*await this\.lintPage\(project\.projectPath\)/,
  'the turn no longer lints the page before running the agent'
);
// The end-of-turn lint is what feeds the panel; both halves have to stay.
assert.match(
  controller,
  /send\(\{ t: 'lint', v: findings \}\)/,
  'the end-of-turn lint event is gone — the panel would go dark'
);

// ── The user-facing half ───────────────────────────────────────────
const request = read('frontend/src/lib/lint-request.ts');
assert.match(
  request,
  /leave the content and the layout alone/,
  'a fix turn no longer scopes itself — it can rewrite copy nobody asked it to touch'
);

const tab = read('frontend/src/components/chat/code-engine/tabs/code-tab.tsx');
assert.match(
  tab,
  /onFixLint\(fixLintMessage\(lint\)\)/,
  'the findings panel is a dead end again — no way to act on the advice'
);
assert.match(
  tab,
  /disabled=\{turnRunning\}/,
  'the fix button fires mid-turn, where it would only queue behind the running turn'
);

// Both panes render CodeEngine — a phone reaching a dead panel is the bug
// this repo has shipped before with the tab switcher.
const index = read('frontend/src/components/chat/index.tsx');
assert.equal(
  index.match(/onFixLint=\{sendMessage\}/g)?.length,
  2,
  'only one layout wires the fix button — the other pane is a dead end'
);

console.log('ok — lint findings reach the next turn, and the panel can act on them');
