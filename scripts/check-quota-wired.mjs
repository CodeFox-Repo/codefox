#!/usr/bin/env node
/**
 * Nothing capped project creation: create and fork both ran unbounded, and
 * the per-project turn queue let one account run a model session per project
 * at once. `quota.spec.ts` / `turn-limit.spec.ts` cover the logic; this
 * guards the wiring, which is what actually rots.
 *
 * The specific failure this exists for: a cap on create alone leaves fork as
 * the documented way around it.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const service = read('backend/src/project/project.service.ts');
const controller = read('backend/src/chat/chat.controller.ts');
const queue = read('backend/src/project/project-queue.ts');

// ── Both creation paths, one function ──────────────────────────────
const create = service.slice(
  service.indexOf('async createProject('),
  service.indexOf('private async createProjectInBackground'),
);
const fork = service.slice(
  service.indexOf('async forkProject'),
  service.indexOf('async createProjectZip'),
);
assert.match(
  create,
  /await this\.assertUnderQuota\(userId\)/,
  'createProject no longer checks the quota',
);
assert.match(
  fork,
  /await this\.assertUnderQuota\(userId\)/,
  'forkProject no longer checks the quota — fork is the way around the cap',
);
// One helper, not two copies that drift.
assert.equal(
  service.match(/private async assertUnderQuota/g)?.length,
  1,
  'the quota check was duplicated instead of shared',
);
// Checked before the name generation, which costs a model call.
assert.ok(
  create.indexOf('assertUnderQuota') < create.indexOf('generateText'),
  'the quota is checked after paying for a generated title',
);

// ── The refusal is actionable ──────────────────────────────────────
const quota = read('backend/src/project/quota.ts');
assert.match(
  quota,
  /which is the limit of \$\{limit\}/,
  'the refusal stopped naming the limit',
);
assert.match(quota, /Delete one/, 'the refusal stopped saying what to do');
// And the UI passes it through rather than flattening it to "failed".
const context = read(
  'frontend/src/components/chat/code-engine/project-context.tsx',
);
assert.equal(
  context.match(/which is the limit of/g)?.length,
  2,
  'a create/fork path swallows the quota message behind a generic error',
);

// ── An unset or broken env means the default, never "no limit" ─────
assert.match(
  quota,
  /Number\.isFinite\(raw\) && raw > 0 \?/,
  'a malformed MAX_PROJECTS_PER_USER can now disable the cap',
);
assert.match(
  read('backend/.env.example'),
  /MAX_PROJECTS_PER_USER/,
  'the cap is undocumented in .env.example (see FRONTEND_URL)',
);

// ── Turns are capped per user, and the slot always comes back ──────
assert.match(
  controller,
  /if \(atTurnLimit\(userId\)\)/,
  'a user can run unlimited concurrent turns again',
);
assert.match(
  controller,
  /withUserTurn\(userId, \(\) => this\.pipeAgent\(chatDto, res\)\)/,
  'turns are no longer counted while they run',
);
// The finally is the whole safety of this: a leaked slot locks the user out
// of their own account until the process restarts.
assert.match(
  queue,
  /\} finally \{[\s\S]*?active\.(set|delete)/,
  'a failed turn no longer releases its slot',
);

console.log('ok — create and fork share one cap, and one account cannot run unlimited turns');
