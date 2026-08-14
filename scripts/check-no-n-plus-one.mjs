#!/usr/bin/env node
/**
 * Two list endpoints that used to run a query per row.
 *
 * Measured with TypeORM's SQL log against a 6-card wall:
 *   gallery        14 queries → 2
 *   adminProjects  13 queries → 8
 *
 * The gallery one was the worse of the two: `Project.user` is already loaded
 * by `fetchPublicProjects` (`relations: ['user']`), but the byline field
 * resolver called `getProjectById` per card anyway — and that helper loads
 * `chats` too, so rendering a wall pulled every conversation of every
 * published project to read three columns off the user.
 *
 * Source assertions: reproducing the counts needs a live backend with SQL
 * logging and a seeded gallery, which is what the E2E stack is for. What
 * regresses here is one `??` and one grouped count going away.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const resolver = read('backend/src/project/project.resolver.ts');
const admin = read('backend/src/admin/admin.service.ts');

// The byline must come off the parent when it is already there.
const byline = resolver.slice(resolver.indexOf("@ResolveField('user'"));
assert.match(
  byline.slice(0, 900),
  /project\.user \?\?/,
  'the gallery byline refetches the project per card again — a wall of N ' +
    'cards costs 2N+2 queries, and the refetch loads every chat as well'
);
// The projection is what keeps this a byline rather than a User; widening it
// would undo the security fix regardless of query count.
for (const field of ['id', 'username', 'avatarUrl']) {
  assert.ok(
    new RegExp(`${field}: user\\.${field}`).test(byline.slice(0, 900)),
    `the byline no longer returns ${field}`
  );
}
assert.doesNotMatch(
  byline.slice(0, 900),
  /email|projects:|chats:/,
  'the byline projection widened — it may only carry what a gallery card shows'
);

// One grouped count for the page, not one count per row.
assert.match(
  admin,
  /private async chatCounts\([\s\S]{0,700}?groupBy/,
  'the admin lists lost their grouped chat count — each row runs its own ' +
    'COUNT again, and the cost grows with the page size'
);
assert.doesNotMatch(
  admin,
  /chats: await this\.chats\.count\(/,
  'an admin list is back to counting chats one row at a time'
);
// The two FKs are genuinely spelled differently; a "tidy-up" that unifies
// them here produces `no such column` at runtime, not at compile time.
assert.ok(
  admin.includes("'projectId' | 'user_id'"),
  'the chat FK column names changed — chat.projectId and chat.user_id are ' +
    'spelled differently on purpose; check the entity before editing'
);

console.log('ok — list endpoints do not run a query per row');
