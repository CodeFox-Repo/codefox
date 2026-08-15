#!/usr/bin/env node
/**
 * A public Next app is openable: /share/<id> serves a booting page instead of
 * 404ing, /api/live/<id> boots the sandbox and answers with its address, the
 * preview proxy knows not to claim that route, and the gallery's shareUrl no
 * longer withholds the link from apps.
 *
 * A script rather than a test suite, per this repo's `pnpm check` convention.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const live = read('backend/src/project/live.controller.ts');
const share = read('backend/src/project/share.controller.ts');
const proxy = read('backend/src/project/preview-proxy.ts');
const shareTs = read('frontend/src/lib/share.ts');
const module_ = read('backend/src/project/project.module.ts');

// ── The endpoint is public but bounded ─────────────────────────────
assert.match(live, /@Public\(\)/, 'live endpoint is not public');
assert.match(
  live,
  /!project\?\.isPublic/,
  'live endpoint does not require a public project — anyone could boot anything'
);
assert.match(
  live,
  /template === 'html'/,
  'live endpoint should refuse html pages — they are served as files'
);
assert.match(
  live,
  /boots\s*=\s*new Map/,
  'concurrent boots are not deduped — every click would start its own server'
);
assert.match(module_, /LiveController/, 'LiveController is not registered');

// ── /share offers the boot instead of a 404 ────────────────────────
assert.match(
  share,
  /template !== 'html'[\s\S]{0,200}bootingPage/,
  '/share no longer routes apps to the booting page'
);

// ── The proxy must not swallow the new route ───────────────────────
assert.match(
  proxy,
  /test\|live/,
  'preview-proxy OURS does not list live — proxied sessions would steal it'
);

// ── The gallery links apps again ───────────────────────────────────
assert.doesNotMatch(
  shareTs,
  /template !== 'html'/,
  'shareUrl still withholds links from Next apps'
);

console.log('ok — a public app is one click from running, for anyone');
