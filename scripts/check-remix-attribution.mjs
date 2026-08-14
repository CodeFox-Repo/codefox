#!/usr/bin/env node
/**
 * A remixed project says where it came from.
 *
 * `forkedFromId` holds the SOURCE's uniqueProjectId — the same key
 * `/share/:id` takes — so the byline is a link and needs no extra query and
 * no backend change. Storing the source's `id` instead would silently point
 * every byline at a 404, which is what this mostly guards.
 *
 * Forking itself already existed (guarded mutation, public-only, copies
 * files, new uniqueProjectId, isPublic=false, atomic fork counter) and the
 * gallery already had its button. Only the attribution was missing.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const service = read('backend/src/project/project.service.ts');
const toolbar = read(
  'frontend/src/components/chat/code-engine/responsive-toolbar.tsx'
);

// ── The byline links to a share id, not a row id ───────────────────
const fork = service.slice(
  service.indexOf('async forkProject'),
  service.indexOf('async createProjectZip')
);
assert.match(
  fork,
  /newProject\.forkedFromId = sourceProject\.uniqueProjectId;/,
  'forkedFromId no longer stores the source uniqueProjectId — every byline would 404'
);
assert.match(
  toolbar,
  /href=\{`\/share\/\$\{forkedFromId\}`\}/,
  'the remix byline no longer links to the source share page'
);
// Only when there is a source. A non-fork must not render a dead link.
assert.match(
  toolbar,
  /\{forkedFromId && !compactIcons && \(/,
  'the byline renders for projects that were never forked'
);

// ── The fork itself keeps its guarantees ───────────────────────────
// These predate this change; the byline is meaningless if they rot.
assert.match(
  fork,
  /newProject\.isPublic = false;/,
  'a fork is now public by default — it would republish someone else’s work'
);
assert.match(
  fork,
  /newProject\.uniqueProjectId = uuidv4\(\);/,
  'a fork reuses the source share id'
);
assert.match(
  fork,
  /if \(!sourceProject\.isPublic && sourceProject\.userId !== userId\)/,
  'a private project can be forked by a stranger'
);
// Atomic, or concurrent forks undercount and the trending wall hides the
// project people are actually copying.
assert.match(
  fork,
  /\.increment\(\s*\n?\s*\{ id: sourceProject\.id \},\s*\n?\s*'subNumber',/,
  'the fork counter went back to read-modify-write'
);

// ── Backward compatible ────────────────────────────────────────────
// An old client hitting a new backend must not break: the field is nullable
// and additive, so a client that never selects it is unaffected.
assert.match(
  read('backend/src/project/project.model.ts'),
  /@Field\(\{ nullable: true \}\)\s*\n\s*@Column\(\{ nullable: true \}\)\s*\n\s*forkedFromId/,
  'forkedFromId stopped being nullable — old rows and old clients break'
);

console.log('ok — a remix links back to what it was remixed from');
