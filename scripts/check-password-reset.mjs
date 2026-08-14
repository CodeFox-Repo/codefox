#!/usr/bin/env node
/**
 * A user who forgot their password had no way back in: `sendPasswordResetEmail`
 * and its template shipped, but nothing ever called them and no UI started the
 * flow. This guards the closed loop, and specifically the parts that are only
 * wrong in ways you cannot see by using it.
 *
 * The token logic itself is covered by `reset-token.spec.ts`. What this adds
 * is the wiring: that the response is not an account oracle, that a reset ends
 * existing sessions, and that both ends of the link agree on the URL.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHmac, timingSafeEqual } from 'node:crypto';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const service = read('backend/src/auth/auth.service.ts');
const resolver = read('backend/src/auth/auth.resolver.ts');
const mail = read('backend/src/mail/mail.service.ts');

// ── Not an account oracle ──────────────────────────────────────────
// The whole point of the identical response. If an unknown address ever
// answers differently from a known one, this endpoint enumerates accounts.
const request = service.slice(
  service.indexOf('async requestPasswordReset'),
  service.indexOf('async resetPassword')
);
assert.ok(
  /if \(!user \|\| !user\.password\) return same;/.test(request),
  'an unknown address no longer gets the same answer — this enumerates accounts'
);
assert.equal(
  request.match(/return same;/g)?.length,
  3,
  'a branch of requestPasswordReset stopped returning the identical response'
);
// Rate limited, or it is an unauthenticated mail cannon aimed at any inbox.
assert.match(
  request,
  /lastEmailSendTime/,
  'the reset request is no longer rate limited'
);

// ── A reset must end existing sessions ─────────────────────────────
// Whoever is resetting may be locked out precisely because somebody else is
// in the account. Leaving refresh tokens alive hands the attacker 7 more days.
const reset = service.slice(
  service.indexOf('async resetPassword'),
  service.indexOf('async sendVerificationEmail')
);
// Routed through endAllSessions, which drops refresh tokens AND kills live
// access tokens — see check-session-revocation.mjs for the both-halves guard.
assert.match(
  reset,
  /await this\.endAllSessions\(user\.id\)/,
  'a password reset no longer ends sessions — the intruder keeps theirs'
);
assert.match(
  reset,
  /newPassword\.length < 8/,
  'the reset path no longer enforces a password length'
);

// ── Reachable without being signed in ──────────────────────────────
// Someone who forgot their password cannot be holding a token. The default
// guard denies everything not marked @Public, so a missing decorator here
// makes the whole feature unreachable.
for (const op of ['requestPasswordReset', 'resetPassword']) {
  assert.match(
    resolver,
    new RegExp(`@Public\\(\\)\\s*\\n\\s*async ${op}\\(`),
    `${op} is not @Public — a locked-out user cannot reach it`
  );
}

// ── Both ends agree on where the link points ───────────────────────
// The mail service has always pointed at /reset-password?token=; the page is
// what was missing. If either moves, the link 404s.
assert.match(
  mail,
  /\/reset-password\?token=\$\{token\}/,
  'the reset email no longer points at /reset-password'
);
read('frontend/src/app/reset-password/page.tsx'); // throws if the page is gone

// ── The single-use property, exercised ─────────────────────────────
// Mirrors reset-token.ts. The key includes the current password hash, so a
// new hash cannot verify an old token — that IS the single use.
const digest = (secret, id, hash, exp) =>
  createHmac('sha256', `${secret}:${hash ?? 'no-password'}`)
    .update(`${id}.${exp}`)
    .digest('base64url');
const verify = (secret, token, hash, now = Date.now()) => {
  const parts = token?.split('.');
  if (!parts || parts.length !== 3) return false;
  const [id, rawExp, mac] = parts;
  const exp = Number(rawExp);
  if (!id || !mac || !Number.isSafeInteger(exp) || exp <= now) return false;
  const a = Buffer.from(digest(secret, id, hash, exp));
  const b = Buffer.from(mac);
  return a.length === b.length && timingSafeEqual(a, b);
};

const OLD = '$2b$10$oldhash', NEW = '$2b$10$newhash';
const exp = Date.now() + 60_000;
const token = `u1.${exp}.${digest('s', 'u1', OLD, exp)}`;
assert.ok(verify('s', token, OLD), 'a fresh token does not verify');
assert.ok(!verify('s', token, NEW), 'the token survives the password change — not single use');
assert.ok(!verify('s', token, OLD, exp + 1), 'an expired token still verifies');
assert.ok(
  !verify('s', `victim.${exp}.${digest('s', 'u1', OLD, exp)}`, OLD),
  'a token can be retargeted at another user'
);

// The source must still derive its key from the password hash, or everything
// above is testing a copy that no longer matches what ships.
assert.match(
  read('backend/src/auth/reset-token.ts'),
  /`\$\{secret\}:\$\{passwordHash \?\? 'no-password'\}`/,
  'the token key no longer includes the password hash — tokens are reusable'
);

console.log('ok — reset links are single-use, session-ending, and say nothing about who has an account');
