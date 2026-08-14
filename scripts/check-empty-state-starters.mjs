#!/usr/bin/env node
/**
 * The workbench's empty state used to be one sentence — "Describe a project
 * above to start one" — which is a dead end for the person who does not know
 * what to type. It now offers concrete starters and a route to the gallery,
 * where remixing someone else's project is a shorter road than a blank box.
 *
 * The property worth guarding: the starters must stay SPECIFIC. A vague one
 * ("a website") makes the planner ask a question card, which is correct
 * behaviour and a bad first experience — the example is supposed to show the
 * product building something.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const workbench = read('frontend/src/components/root/workbench.tsx');
const wall = read('frontend/src/components/root/public-projects.tsx');
const form = read('frontend/src/components/root/prompt-form.tsx');

// ── The starters exist and are specific ────────────────────────────
// Read the STARTERS array itself, not "any long string in the file": a
// short vague entry is exactly what must be caught, so the pattern cannot
// require length to match in the first place.
const block = workbench.slice(
  workbench.indexOf('const STARTERS = ['),
  workbench.indexOf('];', workbench.indexOf('const STARTERS = [')),
);
const starters = [...block.matchAll(/'([^']+)'/g)].map((m) => m[1]);
assert.ok(
  starters.length >= 3,
  `expected at least 3 example prompts, found ${starters.length}`,
);
for (const starter of starters) {
  // Long enough to name a kind AND a detail. "A website" is 9 characters and
  // is exactly what this guards against.
  assert.ok(
    starter.split(' ').length >= 6,
    `"${starter}" is too vague to build from — it would trigger a question card`,
  );
}

// ── Clicking one fills the composer ────────────────────────────────
// Via the ref that already existed for reading it; a second copy of the
// composer's state would be the alternative.
assert.match(
  form,
  /setMessage: \(text: string\) => void;/,
  'the prompt form no longer exposes setMessage — the starters cannot fill it',
);
assert.match(
  workbench,
  /promptFormRef\.current\?\.setMessage\(starter\)/,
  'clicking a starter no longer fills the composer',
);
// The composer is off-screen on a phone; without this the click looks dead.
assert.match(
  workbench,
  /window\.scrollTo\(\{ top: 0, behavior: 'smooth' \}\)/,
  'the page no longer scrolls to the composer, so the click looks like nothing happened',
);

// ── The gallery route resolves ─────────────────────────────────────
// An anchor with no target is a link that silently does nothing.
assert.match(
  workbench,
  /href="#built-with-codefox"/,
  'the empty state no longer points at the gallery',
);
assert.match(
  wall,
  /id="built-with-codefox"/,
  'the gallery lost the id the empty state links to — the link goes nowhere',
);

console.log('ok — the empty state offers specific starters and a way to the gallery');
