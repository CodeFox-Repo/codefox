#!/usr/bin/env node
/**
 * Email lookups were case-sensitive everywhere except `requestPasswordReset`,
 * which lowercased its input. So an account registered as `Foo@x.com` could
 * never be found by "forgot password" — and that endpoint answers identically
 * whether or not the address exists, so the user waited forever for an email
 * nobody had failed to send. The same gap let `Foo@` and `foo@` register twice.
 *
 * The fix is one lookup function comparing LOWER on both sides. This guards
 * that no caller goes back to a raw `where: { email }`, which is how five of
 * the six drifted from the one that was right.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const service = read('backend/src/auth/auth.service.ts');
const finder = read('backend/src/auth/find-by-email.ts');

// ── No raw email lookups left ──────────────────────────────────────
// `where: { email }` / `where: { email: x }` is the shape that was wrong at
// five of six sites.
// `email }` (shorthand) as well as `email:` / `email,` — the shorthand form
// is exactly what five of the six sites used.
const raw = service.match(/where:\s*\{\s*email\s*[,:}]/g) ?? [];
assert.equal(
  raw.length,
  0,
  `${raw.length} case-sensitive email lookup(s) are back — forgot-password silently misses those accounts`,
);
// Every path that looked one up still does.
assert.ok(
  (service.match(/findUserByEmail\(/g) ?? []).length >= 6,
  'a lookup stopped going through the shared finder',
);

// ── Both sides lowered, so legacy rows stay reachable ──────────────
// Normalising only on write would make every mixed-case row in production
// unfindable — i.e. those users could no longer log in.
assert.match(
  finder,
  /LOWER\(user\.email\) = :email/,
  'the lookup no longer lowers the COLUMN — existing mixed-case accounts become unreachable',
);
assert.match(
  finder,
  /email\?\.trim\(\)\.toLowerCase\(\)/,
  'the lookup no longer lowers the INPUT',
);
// Empty input must not match the first row in the table.
assert.match(
  finder,
  /if \(!wanted\) return Promise\.resolve\(null\)/,
  'an empty email is no longer refused before hitting the database',
);

// ── A duplicate pair resolves the same way every time ──────────────
// Production may already hold `Foo@x.com` AND `foo@x.com`; both match the
// lowered comparison. Without an ORDER BY, which account you log into is up
// to the query planner.
assert.match(
  finder,
  /CASE WHEN user\.email = :exact THEN 0 ELSE 1 END/,
  'a duplicate email pair no longer prefers the exact match — which row wins is undefined',
);
assert.match(
  finder,
  /addOrderBy\('user\.createdAt', 'ASC'\)/,
  'the duplicate tie-break is gone',
);

// ── New rows stored normalised ─────────────────────────────────────
assert.match(
  service,
  /const email = registerUserInput\.email\?\.trim\(\)\.toLowerCase\(\)/,
  'registration stores the raw address again, so new mixed-case rows appear',
);

console.log('ok — one email lookup, case-insensitive, legacy rows still reachable');
