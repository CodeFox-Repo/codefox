import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Roles say which accounts are admins. As a @ResolveField on User they ran
// with NO guard — APP_GUARD does not reach field resolvers unless
// `fieldResolverEnhancers` is set — so anonymous callers could walk
// fetchPublicProjects (@Public) → Project.user → roles and enumerate admins.
const resolver = readFileSync('backend/src/user/user.resolver.ts', 'utf8');
const model = readFileSync('backend/src/user/user.model.ts', 'utf8');
const schema = readFileSync('frontend/src/graphql/schema.gql', 'utf8');

assert.ok(
  !/@ResolveField\(\(\) => \[String\]\)/.test(resolver),
  'roles is a field resolver again — unguarded, reachable from any public query'
);
assert.match(
  resolver,
  /@Query\(\(\) => \[String\]\)\s*\n\s*@UseGuards\(JWTAuthGuard\)\s*\n\s*async myRoles/,
  'myRoles is not a guarded top-level query'
);
assert.ok(
  !/@Field\(\(\) => \[String\]\)\s*\n\s*@ManyToMany\(\(\) => Role\)/.test(
    model
  ),
  'roles is exposed on the User model again'
);

// The schema is generated, so it is the honest record of what is reachable.
const userType = schema.match(/^type User \{[\s\S]*?^\}/m)?.[0] ?? '';
assert.ok(userType, 'no User type in the schema');
assert.ok(
  !/\broles\b/.test(userType),
  'User.roles is back in the schema — anonymous callers can traverse to it'
);
assert.match(
  schema,
  /^  myRoles: \[String!\]!$/m,
  'myRoles missing from Query'
);

// Nothing may ask for roles through a User selection any more.
const request = readFileSync('frontend/src/graphql/request.ts', 'utf8');
const meQuery = request.match(/query me \{[\s\S]*?\n`/)?.[0] ?? '';
assert.ok(
  !/\broles\b/.test(meQuery),
  'the me query selects roles again — that field no longer exists'
);

console.log('ok — roles served only by the guarded myRoles query');
