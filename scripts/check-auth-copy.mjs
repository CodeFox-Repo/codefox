#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const signup = read('frontend/src/components/sign-up-modal.tsx');
const signin = read('frontend/src/components/sign-in-modal.tsx');
const settings = read('frontend/src/components/settings/settings.tsx');
const reset = read('frontend/src/app/reset-password/page.tsx');
const confirm = read('frontend/src/app/auth/confirm/page.tsx');
const oauth = read('frontend/src/app/auth/oauth-callback/page.tsx');
const resolver = read('backend/src/auth/auth.resolver.ts');
const service = read('backend/src/auth/auth.service.ts');
const client = read('frontend/src/lib/client.ts');

assert.match(
  client,
  /if \(networkErrorOperation !== 'Login'\) \{\s+window\.location\.href = '\/';/,
  'a Login transport failure must not reload away its inline recovery message'
);
const networkCleanup = client.slice(
  client.indexOf('const networkErrorOperation')
);
assert.match(
  networkCleanup,
  /localStorage\.removeItem\(LocalStore\.accessToken\)/
);
assert.match(
  networkCleanup,
  /localStorage\.removeItem\(LocalStore\.refreshToken\)/
);

assert.match(
  read('frontend/src/lib/auth-copy.ts'),
  /at least two of these/,
  'signup must explain the actual two-character-type rule'
);
assert.doesNotMatch(
  signup,
  /Include at least one uppercase letter|Include at least one number|Include at least one special character/
);
assert.match(signup, /aria-describedby="signup-password-help"/);
assert.match(signup, /resendStatus === 'success'/);
assert.doesNotMatch(
  signup,
  /includes\('has been resent'\)/,
  'resend state must not depend on English wording'
);
assert.match(signup, /Display name/);
assert.match(signup, /Shown next to your public projects/);
assert.match(
  signin,
  /getSignInErrorMessage\(error\)/,
  'sign-in must classify errors rather than blame all on credentials'
);
assert.match(
  signin,
  /forgot \? 'Reset your password' : 'Sign in'/,
  'the accessible dialog title must follow its state'
);
assert.match(signin, /PASSWORD_RESET_EMAIL_AVAILABLE/);
assert.match(signin, /passwordResetEmailAvailable === true/);
assert.match(
  signin,
  /if \(!resetEmailAvailable\) return;/,
  'the reset submit handler must refuse unavailable or unknown capability'
);
assert.match(signin, /sending \|\| !email \|\| !resetEmailAvailable/);
assert.match(
  resolver,
  /@Public\(\)\s+passwordResetEmailAvailable\(\)/,
  'reset capability must be global and public'
);
assert.match(
  service,
  /get passwordResetEmailAvailable\(\): boolean \{\s+return this\.isMailEnabled;/
);
assert.match(settings, /title="Display name"/);
assert.match(settings, /Press Enter or leave this field to save/);
assert.doesNotMatch(
  reset + confirm + oauth,
  /missing its token|No token provided|Authentication failed: Missing tokens/
);
assert.match(reset, /This reset link is incomplete/);
assert.match(confirm, /This verification link is incomplete/);

// Copy changes must not silently change password requirements or session rules.
assert.match(
  read('backend/src/user/dto/register-user.input.ts'),
  /@MinLength\(6\)/
);
assert.match(service, /newPassword\.length < 8/);
assert.match(service, /await this\.endAllSessions\(user\.id\)/);
assert.match(service, /if \(!user \|\| !user\.password\) return same;/);
console.log(
  'ok — auth copy matches state, recovery availability, and unchanged security rules'
);
