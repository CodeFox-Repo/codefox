#!/usr/bin/env node
/**
 * Two UI regressions that only show up at a real width, so nothing in the
 * test suite would catch either.
 *
 * 1. The model picker sat in the input row. In the 18% chat rail that left
 *    the textarea 34px — one character per line. Measured in a browser:
 *    row 225px, left group 147px, send 28px. Moving the picker to its own
 *    row took the textarea to 153px.
 * 2. A turn that died mid-question-block leaves the ```codefox-questions
 *    fence open. The stripper existed but only ran while streaming, so that
 *    message rendered its raw JSON on every reload, forever.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const bottombar = read('frontend/src/components/chat/chat-bottombar.tsx');
const list = read('frontend/src/components/chat/chat-list.tsx');

// ── The picker is out of the input row ─────────────────────────────
// The form is the input row; anything inside it competes with the textarea
// for width, and the textarea is the thing that must win.
const form = bottombar.slice(bottombar.indexOf('<form'));
assert.ok(
  !/<Select\b/.test(form),
  'the model picker is back inside the input row — the textarea loses its width again'
);
assert.ok(
  /<Select\b/.test(bottombar.slice(0, bottombar.indexOf('<form'))),
  'the model picker vanished entirely rather than moving above the input'
);
// It still has to be reachable, and still only when there is a choice to make.
assert.match(
  bottombar,
  /\{onModelChange && \(models\?\.length \?\? 0\) > 1 && \(/,
  'the picker no longer hides itself when there is only one model'
);
assert.match(
  bottombar,
  /aria-label="Model"/,
  'the picker lost its accessible name'
);

// ── The textarea keeps its flex escape hatch ───────────────────────
assert.match(
  form,
  /relative flex min-w-0 flex-1 items-center/,
  'the textarea wrapper lost min-w-0/flex-1 — content width becomes its floor again'
);

// ── An unclosed fence is stripped in history, not just live ────────
// Gating this on isStreaming is exactly the bug: the dead turn is the one
// that keeps the open fence.
assert.ok(
  !/isStreaming\(index\)\s*\n?\s*\?\s*stripPartialQuestionFence/.test(list),
  'the partial-fence strip is gated on streaming again — a died turn shows raw JSON forever'
);
assert.equal(
  list.match(/stripPartialQuestionFence\(/g)?.length,
  2,
  'expected both render paths (prose and turn trail) to strip the partial fence'
);

// The stripper must still leave a COMPLETE block alone, or every question
// card silently becomes nothing. Mirrors question-card.tsx.
const FENCE = /```codefox-questions\s*\n([\s\S]*?)```/;
const PARTIAL_FENCE = /```codefox-questions[\s\S]*$/;
const strip = (c) => (FENCE.test(c) ? c : c.replace(PARTIAL_FENCE, ''));

const complete =
  'Here you go.\n```codefox-questions\n{"questions":[]}\n```\nafter';
assert.equal(strip(complete), complete, 'a complete block was stripped');
assert.equal(
  strip('Building it.\n```codefox-questions\n{"intro":"half'),
  'Building it.\n',
  'an unclosed block is not stripped'
);
assert.equal(strip('no fence at all'), 'no fence at all', 'ordinary prose was touched');

console.log('ok — the composer keeps its width, and a died turn hides its half-written JSON');
