#!/usr/bin/env node
/**
 * Every "Web app" project is born with a database: better-sqlite3 in the
 * shared template install, a getDb() helper injected into the project at
 * scaffold time, and scenario guidance that tells the agent both exist.
 * Three pieces, one feature — any one of them missing and the agent either
 * has no driver, no helper, or no idea the database is there.
 *
 * A script rather than a test suite, per this repo's `pnpm check` convention.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const scaffold = read('backend/src/project/scaffold.ts');
const scenarios = read('backend/src/project/scenarios.ts');

// ── The driver is in the shared install ────────────────────────────
// Projects symlink the template's node_modules, so an install anywhere else
// reaches no project. The guard has to be in ensureTemplate, not at project
// creation time — by then the symlink is already made.
assert.match(
  scaffold,
  /npm'[\s\S]{0,200}better-sqlite3/,
  'scaffold.ts never installs better-sqlite3 into the shared template'
);

// ── The helper lands in every scaffolded app ───────────────────────
assert.match(
  scaffold,
  /src\/lib\/db\.ts/,
  'scaffoldProject no longer writes src/lib/db.ts'
);
assert.match(
  scaffold,
  /better-sqlite3';\nimport { mkdirSync }/,
  'the db helper does not import better-sqlite3'
);
// The file is data, not source: without the ignore, the first commit after
// any write would bake a binary database into the project's history.
assert.match(
  scaffold,
  /appendFile[\s\S]{0,200}data\//,
  'the project .gitignore no longer excludes the database file'
);

// ── The agent is told it exists ────────────────────────────────────
// A helper nobody mentions is reinvented badly. The app scenario's guidance
// is the one place every app turn reads.
const appScenario = scenarios.match(
  /id: 'app',[\s\S]*?guidance: `([\s\S]*?)`,\n  \},/
);
assert.ok(appScenario, 'the app scenario is gone or lost its guidance');
assert.match(
  appScenario[1],
  /@\/lib\/db/,
  "the app scenario's guidance never mentions @/lib/db"
);
assert.match(
  appScenario[1],
  /CREATE TABLE IF NOT EXISTS/,
  'the guidance no longer says how schema is created'
);

console.log('ok — app projects are born with a database, and the agent knows');
