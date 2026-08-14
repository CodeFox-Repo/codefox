#!/usr/bin/env node
/**
 * The landing page has to fit a phone, and Sign Up has to be on it.
 *
 * Two independent CSS-grid min-content traps put 17-47px of the page off the
 * right edge of a 390px screen, and the thing hanging off the edge was the
 * Sign Up button — the one control the landing page exists to offer.
 *
 * Source assertions rather than a browser: this repo's `pnpm check` runs with
 * bare node and no framework, and both fixes are a single class each. A
 * headless run would need a built frontend and a free port, which is what the
 * E2E suite is for.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const landing = read('frontend/src/app/(main)/page.tsx');
const nav = read('frontend/src/components/root/nav.tsx');

// A grid track's default floor is min-content, so the column sized itself to
// the longest file path in the tool-call table and refused to shrink. A
// min-w-0 on the child cannot fix it — the TRACK is what will not give.
assert.match(
  landing,
  /grid grid-cols-\[minmax\(0,1fr\)\] gap-10 lg:grid-cols-2/,
  'the tool-call section is back on an implicit 1fr track — its min-content ' +
    'floor is the longest path in the table, which overflows a phone'
);

// Same trap one level down: `truncate` cannot truncate a cell whose track
// will not shrink below its content.
assert.match(
  landing,
  /<span className="min-w-0 truncate">\{c\.target\}<\/span>/,
  'the truncating cell lost its min-w-0, so `truncate` never fires and the ' +
    'row grows to fit the longest path'
);

// The capsule cannot hold the star count and both auth buttons on a narrow
// phone. The star count is decoration; Sign Up is the product.
// The class sits a few lines after the href, past a comment block — so take
// the first className after the link opens, not a fixed-size window.
const star = nav.slice(nav.indexOf('github.com/Sma1lboy'));
const starClass = star.match(/className="([^"]*)"/)?.[1] ?? '';
assert.ok(
  /\bhidden\b/.test(starClass) && /min-\[400px\]:flex/.test(starClass),
  'the GitHub star link is visible again under 400px — it pushes Sign Up off ' +
    'the right edge of a 390px phone, where nothing can reach it'
);

// The signed-in composer, same class of bug one page over: three pickers
// (visibility, kind, style) sit in one nowrap row. `min-w-0` lets the ROW
// shrink but the triggers inside are whitespace-nowrap, so they spilled past
// the card — the kind and style pickers ended up off a 390px screen entirely,
// and nothing on the page could reach them.
const composer = read('frontend/src/components/root/prompt-form.tsx');
assert.match(
  composer,
  /<div className="flex min-w-0 flex-wrap items-center gap-2">/,
  'the composer picker row cannot wrap again — the kind and style pickers go ' +
    'off the right edge of a phone, where nothing can reach them'
);

console.log('ok — landing and composer both fit a phone, controls reachable');
