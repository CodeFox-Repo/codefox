#!/usr/bin/env node
/**
 * Settings could change a username and an avatar but not a password — there
 * was no mutation and no form. This guards the parts of the closed loop that
 * are wrong in ways you cannot see by using it successfully.
 *
 * `change-password.spec.ts` covers the service behaviour. This is the wiring.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const service = read('backend/src/auth/auth.service.ts');
const resolver = read('backend/src/auth/auth.resolver.ts');
const settings = read('frontend/src/components/settings/settings.tsx');

const change = service.slice(
  service.indexOf('async changePassword'),
  service.indexOf('async requestPasswordReset')
);

// ── A session is not authorisation to take the account over ────────
// The whole reason this is not resetPassword-with-a-guard: someone who picks
// up an unlocked laptop must not be able to lock the owner out.
assert.match(
  change,
  /compare\(currentPassword \?\? '', user\.password\)/,
  'the current password is no longer verified — a stolen session becomes a stolen account'
);
// Guarded too. Without this anyone could change anyone's password.
assert.match(
  resolver,
  /@UseGuards\(JWTAuthGuard\)\s*\n\s*async changePassword\(/,
  'changePassword is not behind the auth guard'
);
// The userId comes from the token, never from an argument — an argument
// would let a caller name someone else's account.
assert.match(
  resolver,
  /@GetUserIdFromToken\(\) userId: string,\s*\n\s*@Args\('currentPassword'\)/,
  'changePassword takes its user from arguments rather than the token'
);

// ── A change ends other sessions, but not this one ─────────────────
assert.match(
  change,
  /await this\.endAllSessions\(userId\)/,
  'changing a password no longer signs out the other devices'
);
assert.match(
  change,
  /storeAccessToken\(accessToken, user\.id\)/,
  'the replacement token is not recorded against the user, so it can never be revoked'
);
// Order matters: minting before revoking would kill the token just issued.
assert.ok(
  change.indexOf('endAllSessions') < change.indexOf('const accessToken'),
  'the new token is minted before the revoke, so the revoke kills it'
);

// ── A Google account is never given a form that must fail ──────────
assert.match(
  change,
  /if \(!user\.password\) \{/,
  'a passwordless account now reaches bcrypt.compare against null'
);
assert.match(
  settings,
  /hasPassword \? \(\s*\n?\s*<PasswordField \/>/,
  'the settings page offers the password form to accounts that have no password'
);
// Undefined means "not answered yet". Rendering the form and then swapping it
// reads as a bug.
assert.match(
  settings,
  /hasPassword !== undefined && \(/,
  'the password row renders before the answer is known'
);

// ── The new tokens are actually adopted ────────────────────────────
// Without this the change succeeds and the user's next request 401s, because
// their stored token was revoked a line earlier.
assert.match(
  settings,
  /login\(\s*\n?\s*data\.changePassword\.accessToken,\s*\n?\s*data\.changePassword\.refreshToken\s*\n?\s*\)/,
  'the fresh tokens are dropped — the user is signed out by their own password change'
);

console.log('ok — password change needs the old password, keeps this device, skips Google accounts');
