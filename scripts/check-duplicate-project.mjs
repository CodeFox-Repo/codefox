#!/usr/bin/env node
/**
 * `duplicateProject` is `forkProject` with one guard flipped — copying your
 * own project, which fork refuses. A unit test cannot reach it: importing
 * project.service pulls in ESM-only deps jest cannot require (the same reason
 * instructions.ts exists as its own module), so this guards the properties
 * against the source.
 *
 * The one that matters most: a self-copy must NOT count as a fork. subNumber
 * is what the trending wall ranks by, so counting it would let anyone promote
 * their own project by pressing Duplicate.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const service = read('backend/src/project/project.service.ts');
const resolver = read('backend/src/project/project.resolver.ts');
const workbench = read('frontend/src/components/root/workbench.tsx');

const fork = service.slice(
  service.indexOf('async forkProject('),
  service.indexOf('async createProjectZip'),
);

// ── One implementation, not two ────────────────────────────────────
assert.match(
  service,
  /async duplicateProject\([\s\S]{0,200}?return this\.forkProject\(userId, projectId, true\)/,
  'duplicateProject no longer delegates to forkProject — two copy paths to keep in sync',
);

// ── The guards, both directions ────────────────────────────────────
assert.match(
  fork,
  /if \(!mine && sourceProject\.userId === userId\)/,
  'forking your own project is allowed again — the wall would offer a no-op',
);
assert.match(
  fork,
  /if \(mine && sourceProject\.userId !== userId\)/,
  'duplicate can copy someone else’s project, bypassing the fork rules',
);

// ── A self-copy is not a fork ──────────────────────────────────────
assert.match(
  fork,
  /if \(!mine\) \{\s*\n\s*await this\.projectsRepository\.increment\(/,
  'a self-copy increments the fork counter — Duplicate becomes a way to game trending',
);

// ── Same cap as everything else that creates a project ─────────────
assert.match(
  fork,
  /await this\.assertUnderQuota\(userId\)/,
  'duplicate no longer inherits the project quota',
);

// ── Guarded, and the id comes from the token ───────────────────────
assert.match(
  resolver,
  /@JWTAuth\(\)\s*\n\s*async duplicateProject\(\s*\n\s*@GetUserIdFromToken\(\) userId/,
  'duplicateProject is unguarded or takes its user from an argument',
);

// ── The UI cannot fire it twice ────────────────────────────────────
assert.match(
  workbench,
  /disabled=\{!chat\.project\?\.id \|\| duplicating\}/,
  'the Duplicate item lost its in-flight guard — a double click makes two copies',
);
// The quota refusal names the limit and the way out; a generic toast hides it.
assert.match(
  workbench,
  /catch\(\(e\) => toast\.error\(e\.message\)\)/,
  'the duplicate error is flattened, hiding the quota message',
);

console.log('ok — duplicate copies only your own, and never counts as a fork');
