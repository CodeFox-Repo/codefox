#!/usr/bin/env node
/**
 * The share page's Remix button lands on `/?remix=<uniqueProjectId>`. This
 * guards the two things that are only wrong in ways you would not notice
 * while testing signed in:
 *
 * - the param must be dropped BEFORE the fork, or a refresh mid-fork forks
 *   the project a second time;
 * - it must NOT be dropped when signed out, or the intent dies between
 *   "sign in to remix" and actually signing in.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const wall = read('frontend/src/components/root/public-projects.tsx');
const chrome = read('backend/src/project/share-chrome.ts');

// ── Landing runs the SAME path the cards use ───────────────────────
// A second fork implementation is a second place for the auth prompt, the
// quota message and the double-click guard to drift.
assert.match(
  wall,
  /void handleFork\(remixParam\)/,
  'the remix landing no longer reuses handleFork',
);
// The link carries the ROW id, which is what forkProject takes. Keyed by
// share id it had to be found on the wall first — and the wall only holds
// the newest six, so remixing an older project silently did nothing.
assert.match(
  wall,
  /const match = projects\.find\(\(p\) => p\.id === remixParam\)/,
  'the remix param is matched against the wrong id',
);
assert.doesNotMatch(
  wall,
  /if \(!match\) return;/,
  'the landing bails when the project is off the wall — only the newest few would be remixable',
);

// ── Refresh cannot double-fork ─────────────────────────────────────
const effect = wall.slice(wall.indexOf('const remixParam'));
assert.ok(
  effect.indexOf("router.replace('/'") < effect.indexOf('void handleFork'),
  'the url is cleaned after forking — a refresh mid-fork forks twice',
);
assert.match(
  effect,
  /claimed\.current === remixParam/,
  'nothing stops the effect re-firing for the same id in the same tick',
);

// ── Signed out keeps the intent ────────────────────────────────────
assert.match(
  effect,
  /if \(!isAuthorized\) \{[\s\S]{0,200}?return;/,
  'a signed-out visitor now falls through to fork, or loses the param',
);
assert.ok(
  effect.indexOf('if (!isAuthorized)') < effect.indexOf("router.replace('/'"),
  'the param is cleared before the auth check, so signing in loses the remix',
);

// ── Double click is still guarded on the cards ─────────────────────
assert.match(
  wall,
  /disabled=\{forking === p\.id\}/,
  'the fork button lost its in-flight guard — a double click forks twice',
);

// ── Remix count shown, but not a zero ──────────────────────────────
// The count is hidden at zero, and the label is "remix" everywhere — the
// gallery used to say "forks" for the same number the share page called
// remixes.
assert.match(
  wall,
  /p\.subNumber\s*\n?\s*\? ` · \$\{p\.subNumber\} remix\$\{p\.subNumber === 1 \? '' : 'es'\}`/,
  'the gallery stopped hiding a zero remix count, or went back to calling it a fork',
);
assert.match(
  chrome,
  /project\.subNumber\s*\n?\s*\? `· \$\{project\.subNumber\} remix/,
  'the share chrome stopped showing the remix count',
);

console.log('ok — a remix link forks once, survives sign-in, and shows its count');
