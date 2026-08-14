import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(p, 'utf8');
const resolver = read('backend/src/admin/admin.resolver.ts');
const service = read('backend/src/admin/admin.service.ts');

// This repo has shipped seven separate authorization holes. The console is the
// one surface that can read every user in the deployment and hand out the role
// that unlocks it, so its guards are worth pinning in source.
assert.match(
  resolver,
  /@UseGuards\(JWTAuthGuard, RolesGuard\)[\s\S]{0,80}@Roles\('Admin'\)[\s\S]{0,120}export class AdminResolver/,
  'the admin resolver is no longer class-level guarded by JWTAuthGuard + ' +
    'RolesGuard + @Roles(Admin), in that order'
);

// Every operation the resolver exposes rides on the class-level guard. A
// method that carried its own @UseGuards would REPLACE it, not add to it.
const overrides = resolver.match(/^\s+@UseGuards\(/gm) ?? [];
assert.equal(
  overrides.length,
  0,
  'a method-level @UseGuards appeared in the admin resolver — it overrides ' +
    'the class-level pair rather than adding to it'
);

// The acting user must come from the verified token. As an @Args it would be
// client-supplied, and the self-lockout guards below would be one edited
// variable away from meaningless.
for (const mutation of ['adminSetUserRole', 'adminSetUserActive']) {
  const body = resolver.slice(
    resolver.indexOf(`${mutation}(`),
    resolver.indexOf('}', resolver.indexOf(`${mutation}(`))
  );
  assert.match(
    body,
    /@GetUserIdFromToken\(\)\s+actingUserId/,
    `${mutation} no longer takes the acting user from the verified token`
  );
  assert.doesNotMatch(
    body,
    /@Args\(['"]actingUserId/,
    `${mutation} takes the acting user as an argument — a caller can now ` +
      `claim to be someone else and step around the self-lockout guard`
  );
}

// An admin who revokes their own Admin role has no way back: there is no other
// grant path in the product, so recovery is hand-written SQL against prod.
// Whitespace-insensitive: prettier reflows this condition across four lines
// once the file is formatted, and a check that fails on formatting is a check
// people learn to ignore.
assert.match(
  service.replace(/\s+/g, ' '),
  /if \( ?!granted && userId === actingUserId && roleName === DefaultRoles\.ADMIN ?\)[\s\S]{0,200}throw new BadRequestException/,
  'the self-revoke guard is gone — an admin can lock themselves out of the ' +
    'console with no way back'
);
// Login refuses an inactive account, so this is the same lockout by a
// different door.
assert.match(
  service,
  /if \(!isActive && userId === actingUserId\)[\s\S]{0,200}throw new BadRequestException/,
  'an admin can disable their own account, ending the session they hold'
);

// The page size reaches a query on the one endpoint that can read every row.
assert.match(
  service,
  /Math\.min\(Math\.floor\(limit\), 100\)/,
  'the page-size ceiling is gone — a caller can ask this endpoint for the ' +
    'whole user table in one query'
);
// ILike is Postgres-only; the local stack and the E2E suite run SQLite. Match
// real use (an import or a call), not the word — it appears in the comment
// that explains why it is not used.
assert.doesNotMatch(
  service,
  /\bILike\s*\(|[{,]\s*ILike\s*[,}]/,
  'admin search uses ILike, which SQLite does not have — the console errors ' +
    'in local dev and in the E2E suite'
);
// LOWER(...) LIKE is the spelling both engines accept, on both lists.
assert.equal(
  (service.match(/LOWER\([a-z]+\.\w+\) LIKE :q/g) ?? []).length,
  4,
  'the case-insensitive search is no longer spelled the way both Postgres ' +
    'and SQLite accept, on both the user and project lists'
);

console.log('ok — admin console is role-gated and cannot lock its operator out');
