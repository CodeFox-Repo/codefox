#!/usr/bin/env node
/**
 * Ending an account's sessions has to end BOTH halves: refresh tokens (which
 * would mint a fresh session for up to 7 days) and the cached access tokens
 * (which keep working for up to 30 minutes). Dropping one is the bug this
 * closes — password reset used to drop refresh only, admin deactivation
 * dropped neither.
 *
 * `revoke-user.spec.ts` covers the cache behaviour. This guards the wiring:
 * that both revoking paths go through the one function, and that the userId
 * needed to revoke is actually recorded at every point a token is issued.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const auth = read('backend/src/auth/auth.service.ts');
const admin = read('backend/src/admin/admin.service.ts');
const cache = read('backend/src/jwt-cache/jwt-cache.service.ts');

// ── One function, both halves ──────────────────────────────────────
const endAll = auth.slice(
  auth.indexOf('async endAllSessions'),
  auth.indexOf('async requestPasswordReset')
);
assert.match(
  endAll,
  /refreshTokenRepository\.delete\(\{ userId \}\)/,
  'endAllSessions no longer drops refresh tokens — a new session can be minted for 7 days'
);
assert.match(
  endAll,
  /jwtCacheService\.removeTokensForUser\(userId\)/,
  'endAllSessions no longer kills live access tokens — they work until they expire'
);

// ── Every path that ends sessions routes through it ────────────────
// Root cause, not symptom: a caller doing half the job by hand is exactly
// how these two drifted apart in the first place.
assert.match(
  auth.slice(auth.indexOf('async resetPassword')),
  /await this\.endAllSessions\(user\.id\)/,
  'password reset no longer ends sessions'
);
const setActive = admin.slice(
  admin.indexOf('async setUserActive'),
  admin.indexOf('async stopPreview')
);
assert.match(
  setActive,
  /await this\.authService\.endAllSessions\(userId\)/,
  'disabling an account no longer signs it out — the button is a suggestion again'
);
// Only on disable. Re-enabling somebody must not kick them.
assert.match(
  setActive,
  /if \(!isActive\) \{/,
  'sessions are ended regardless of direction — re-enabling a user would sign them out'
);
// gap-agent's self-lockout guard sits in this method; make sure it survived.
assert.match(
  setActive,
  /userId === actingUserId/,
  'the self-disable guard is gone'
);

// ── The userId has to be recorded, or there is nothing to revoke ───
// This is the quiet failure: revocation silently matches zero rows and every
// session survives, with no error anywhere.
const stores = auth.match(/storeAccessToken\([^)]*\)/g) ?? [];
assert.ok(stores.length >= 3, 'expected every login path to store a token');
for (const call of stores) {
  assert.match(
    call,
    /storeAccessToken\(\s*accessToken,\s*\S+/,
    `a token is stored without its userId (${call}) — it can never be revoked`
  );
}
assert.match(
  cache,
  /DELETE FROM jwt_cache WHERE user_id = \?/,
  'the cache no longer revokes by user'
);
// `function` not an arrow, or `this.changes` is the service and the count is
// undefined — the caller then logs "ended undefined sessions".
assert.match(
  cache,
  /\[userId\],\s*\n\s*function \(err\) \{/,
  'the delete callback is an arrow again — this.changes is not the row count'
);

console.log('ok — one revoke ends both halves, on reset and on deactivation');
