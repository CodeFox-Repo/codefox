#!/usr/bin/env node
/**
 * The public surface — landing page, gallery, /share/* — is how this product
 * spreads. It shipped with no robots.txt, no sitemap, no og card of its own,
 * and a placeholder description repeated as the title.
 *
 * The subtle one this guards: `(main)/layout.tsx` also declared metadata, and
 * being nested it WON — so the root layout's real title and card never
 * reached the page. Two metadata exports is how that happens silently.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const root = read('frontend/src/app/layout.tsx');
const main = read('frontend/src/app/(main)/layout.tsx');
const robots = read('frontend/src/app/robots.ts');
const chrome = read('backend/src/project/share-chrome.ts');
const sitemap = read('frontend/src/app/sitemap.ts');

// ── One metadata owner ─────────────────────────────────────────────
assert.doesNotMatch(
  main,
  /export const metadata/,
  'a nested layout declares metadata again — it overrides the root card silently',
);
assert.match(root, /openGraph:/, 'the app lost its own og card');
assert.match(
  root,
  /metadataBase: new URL\(siteUrl\(\)\)/,
  'without metadataBase the og:image stays relative and no crawler can fetch it',
);
assert.doesNotMatch(
  root,
  /The best dev project generator/,
  'the placeholder description is back',
);

// ── Private routes stay out of the index ───────────────────────────
// A reset link in a search result is a credential in public.
for (const path of ['/chat', '/settings', '/admin', '/auth/', '/reset-password']) {
  assert.ok(
    robots.includes(`'${path}'`),
    `${path} is no longer disallowed — a signed-in surface would be indexed`,
  );
}
assert.match(robots, /sitemap:/, 'robots.txt stopped pointing at the sitemap');

// ── Shared pages have one canonical url ────────────────────────────
// Forwarded links collect ?utm_source=…; each variant is otherwise a separate
// page competing with itself.
assert.match(
  chrome,
  /rel="canonical" href="\$\{appOrigin\}\/share\/\$\{encodeURIComponent\(project\.uniqueProjectId\)\}"/,
  'the share page lost its canonical, so tracking params fork the url',
);

// ── The sitemap is built per request, not per deploy ───────────────
// With `revalidate` alone Next PRERENDERS it, and the build runs where no
// backend is reachable — so the fetch failed and the deployed sitemap froze
// with the home page only. Measured: `○ /sitemap.xml` (static) before,
// `ƒ` (dynamic) after.
assert.match(
  sitemap,
  /export const dynamic = 'force-dynamic'/,
  'the sitemap is prerendered again — it will ship with the home page only',
);
// And a backend that is down must not fail the build or the request.
assert.match(
  sitemap,
  /\} catch \{\s*\n\s*return home;/,
  'the sitemap no longer degrades when the backend is unreachable',
);

console.log('ok — public pages are indexable and canonical, private ones are not');
