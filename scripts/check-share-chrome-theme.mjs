#!/usr/bin/env node
/**
 * The share chrome is served by the backend, so it cannot reach globals.css
 * and has to inline its colours. That is how it ended up hardcoded dark —
 * a dark slab in a light browser, on the one page strangers actually see.
 *
 * Dark stays the default (it is the designed theme); a visitor whose OS asks
 * for light gets the app's real paper palette rather than an inversion.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const chrome = read('backend/src/project/share-chrome.ts');
const css = read('frontend/src/app/globals.css');

assert.match(
  chrome,
  /@media \(prefers-color-scheme: light\)/,
  'the share chrome no longer offers a light variant',
);
assert.match(
  chrome,
  /color-scheme: dark light/,
  'the chrome no longer tells the browser it supports both — form controls and scrollbars stay dark',
);

// Every colour goes through a variable, so a future edit cannot reintroduce
// a literal that only works in one theme.
const body = chrome.slice(chrome.indexOf('<style>'), chrome.indexOf('</style>'));
const literals = [...body.matchAll(/(background|color|border[^:]*):\s*#[0-9a-f]{3,8}/gi)];
assert.equal(
  literals.length,
  0,
  `${literals.length} hardcoded colour(s) outside the token block: ${literals.map((m) => m[0]).join(', ')}`,
);

// The light values must be the app's own, not invented ones — otherwise the
// shared page and the product drift apart.
for (const hex of ['#faf9f5', '#b0532f']) {
  assert.ok(
    chrome.toLowerCase().includes(hex),
    `light palette lost ${hex}, which is what globals.css uses`,
  );
  assert.ok(
    css.toLowerCase().includes(hex.replace('#', '')) ||
      css.toLowerCase().includes(hex),
    `${hex} is no longer in globals.css — the chrome is copying a stale value`,
  );
}

console.log('ok — the shared page follows the visitor’s theme, using the app’s own palette');
