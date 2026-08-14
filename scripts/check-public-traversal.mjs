import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * The public gallery must not be a doorway into private data.
 *
 * `fetchPublicProjects` is @Public and returns `Project`. Field resolvers run
 * with NO guard — APP_GUARD does not reach them unless `fieldResolverEnhancers`
 * is set, and it is not — so every @Field on a type reachable from that query
 * is world-readable whatever the resolver above it says. The `roles` fix
 * (check-roles-guarded) closed one edge of this; these are the rest:
 *
 *   fetchPublicProjects → Project.user → User.chats  → Chat.messages
 *   fetchPublicProjects → Project.user → User.projects (private ones, with
 *                                        projectPath — the directory name the
 *                                        authenticated file routes key on)
 *   fetchPublicProjects → Project.chats → Chat.messages → Chat.user
 *
 * The schema is generated from the models, so it is the honest record of what
 * is actually reachable — assert against it, not only against the decorators.
 */
const schema = readFileSync('frontend/src/graphql/schema.gql', 'utf8');
const userModel = readFileSync('backend/src/user/user.model.ts', 'utf8');
const projectModel = readFileSync(
  'backend/src/project/project.model.ts',
  'utf8'
);
const projectResolver = readFileSync(
  'backend/src/project/project.resolver.ts',
  'utf8'
);

const typeOf = (name) =>
  schema.match(new RegExp(`^type ${name} \\{[\\s\\S]*?^\\}`, 'm'))?.[0] ?? '';

const userType = typeOf('User');
const projectType = typeOf('Project');
assert.ok(userType, 'no User type in the schema');
assert.ok(projectType, 'no Project type in the schema');

// The gallery byline is the only reason Project.user exists. Traversing on
// from it must reach nothing.
for (const field of ['chats', 'projects']) {
  assert.ok(
    !new RegExp(`^  ${field}:`, 'm').test(userType),
    `User.${field} is back in the schema — anonymous callers reach it through ` +
      `fetchPublicProjects → Project.user, with no guard anywhere on the path`
  );
}
assert.ok(
  !/^  chats:/m.test(projectType),
  'Project.chats is back in the schema — that is every public project’s whole ' +
    'build conversation, readable by anyone, plus Chat.user onward from it'
);

// And the models, so the next @Field added here is a deliberate act.
assert.ok(
  !/@Field\(\(\) => \[Chat\]\)\s*\n\s*@OneToMany/.test(userModel),
  'User.chats is decorated @Field again'
);
assert.ok(
  !/@Field\(\(\) => \[Project\]\)\s*\n\s*@OneToMany/.test(userModel),
  'User.projects is decorated @Field again'
);
assert.ok(
  !/@Field\(\(\) => \[Chat\]\)\s*\n\s*@OneToMany/.test(projectModel),
  'Project.chats is decorated @Field again'
);

// The TYPE is the boundary, not the resolver. A field resolver's declared
// return type is what the schema offers, whatever the resolver hands back —
// so narrowing the projection to id/username/avatarUrl was NOT enough on its
// own: `Project.user` was still typed `User`, `user { email }` still resolved
// off the entity, and the gallery stayed a scrapable list of every
// publisher's address. It is typed `Byline` now, which has nothing to leak.
const projectUser = typeOf('Project').match(/^  user: (\w+)!/m)?.[1];
assert.equal(
  projectUser,
  'Byline',
  `Project.user is typed ${projectUser} — anything that type exposes is ` +
    'anonymously readable through the @Public gallery query'
);

const bylineType = typeOf('Byline');
assert.ok(bylineType, 'the Byline type is gone from the schema');
const bylineFields = [...bylineType.matchAll(/^  (\w+):/gm)].map((m) => m[1]);
assert.deepEqual(
  bylineFields.sort(),
  ['avatarUrl', 'id', 'username'],
  `Byline grew fields (${bylineFields}) — everything on it is public`
);

// The resolver still has to hand back only those three.
const byline =
  projectResolver.match(/@ResolveField\('user'[\s\S]*?\n  \}/)?.[0] ?? '';
assert.ok(byline, 'the Project.user field resolver is gone entirely');
assert.ok(
  !/return user;/.test(byline),
  'Project.user returns the whole User entity again'
);
assert.match(
  byline,
  /username: user\.username/,
  'the byline projection no longer carries username, which is what it is for'
);

// The guarded path must keep working: settings reads the signed-in user's own
// address through `me`, so removing the field outright would be a fix that
// broke the feature instead of the leak.
assert.match(
  typeOf('User'),
  /^  email: String!$/m,
  'User.email is gone — `me { email }` is the settings page’s own account, ' +
    'and it is guarded; the leak was the unguarded Project.user edge'
);

// Nothing may select the removed fields, or every such query 400s.
const request = readFileSync('frontend/src/graphql/request.ts', 'utf8');
const publicQuery =
  request.match(/query FetchPublicProjects[\s\S]*?\n`/)?.[0] ?? '';
assert.ok(publicQuery, 'the public gallery query is gone');
assert.ok(
  !/\bchats\b/.test(publicQuery),
  'the gallery query selects chats again — that field no longer exists'
);

console.log('ok — the public gallery leads to a byline and nothing else');
