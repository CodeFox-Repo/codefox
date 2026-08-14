#!/usr/bin/env node
/**
 * NOTES.md is the project's design contract: the agent records decisions in
 * it ("no pricing section until we have real numbers") and it is read back
 * into EVERY turn's prompt. It was also completely invisible — nothing in the
 * frontend mentioned it, so a user could not see what the agent believed and
 * could not correct a wrong line except by asking in prose.
 *
 * This guards the two things that make it a contract rather than a text box:
 * the file the dialog edits is the same one the prompt reads, and a project
 * with no notes yet opens editable instead of erroring.
 *
 * A script rather than a test suite, per this repo's `pnpm check` convention:
 * the frontend has no runner, and what breaks here is wiring, not logic.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const dialog = read('frontend/src/components/chat/code-engine/notes-dialog.tsx');
const instructions = read('backend/src/chat/instructions.ts');
const controller = read('backend/src/chat/chat.controller.ts');
const agent = read('backend/src/chat/project-agent.ts');

// ── The two ends have to name the same file ────────────────────────
// This is the whole point: an editor pointed at `notes.md` or `NOTES.MD`
// would save happily and the agent would never read a word of it.
assert.match(
  dialog,
  /const NOTES_PATH = 'NOTES\.md'/,
  'the dialog no longer edits NOTES.md — it would be saving to a file nothing reads'
);
assert.match(
  controller,
  /readFile\('NOTES\.md'\)/,
  'the turn no longer reads NOTES.md — the dialog would edit a file nothing consumes'
);
assert.match(
  instructions,
  /Keep NOTES\.md in the project root as its memory/,
  'the agent is no longer told to keep NOTES.md'
);
// Read back into the prompt, which is what makes an edit take effect.
assert.match(
  agent,
  /\$\{notesNote\(notes\)\}/,
  'notes are no longer in the prompt — editing them would change nothing'
);

// ── A project with no notes yet must open editable ─────────────────
// readFile returns null for a missing file and the controller turns that
// into a 404. Treating that as an error would mean the feature only works
// for projects whose agent happened to have written notes already — i.e.
// never on a fresh project, which is exactly when a user wants to set the
// rules.
assert.match(
  dialog,
  /res\.status === 404/,
  'a project with no NOTES.md yet now shows an error instead of an empty contract'
);

// ── A failed read must not become an empty save ────────────────────
// The destructive case: load fails, textarea shows "", user hits Save, and
// whatever the agent had recorded is gone.
assert.match(
  dialog,
  /setFailed\(true\)/,
  'a failed read no longer marks the dialog failed'
);
assert.match(
  dialog,
  /disabled=\{loading \|\| saving \|\| failed \|\| text === saved\}/,
  'Save is reachable while loading or after a failed read — it would erase the real notes'
);
// A failed SAVE must keep the dialog open; closing would discard the text.
assert.ok(
  !/onOpenChange\(false\)[\s\S]{0,120}Could not save these notes/.test(dialog),
  'a failed save closes the dialog, throwing away what the user just typed'
);

// ── Reachable from both layouts ────────────────────────────────────
// This repo has shipped a desktop-unreachable control before (the API key
// lived only in the ≤450px overflow menu), so both paths are asserted.
const toolbar = read(
  'frontend/src/components/chat/code-engine/responsive-toolbar.tsx'
);
assert.equal(
  toolbar.match(/setNotesOpen\(true\)/g)?.length,
  2,
  'Notes is missing from one of the two toolbar layouts (desktop / compact menu)'
);
assert.match(
  toolbar,
  /<NotesDialog/,
  'the toolbar never renders the dialog, so the button opens nothing'
);
// Not gated on `isPage`: both project kinds keep notes, and instructionsFor
// appends NOTES_SECTION on the Next path too.
assert.match(
  instructions,
  /\[INSTRUCTIONS, shape, NOTES_SECTION\]/,
  'Next projects no longer get the notes section — the button should then be page-only'
);

// ── A hand edit is attributed to the user, not the agent ───────────
// Saving notes writes the working tree without committing. The pre-turn
// snapshot is what stops the next turn folding that into the agent's commit
// under the agent's prompt as its label.
assert.match(
  controller,
  /await workspace\.snapshot\('Your edits'\)/,
  'a notes edit would be swept into the agent commit and lost on a restore'
);

console.log('ok — the notes dialog edits the same contract every turn reads');
