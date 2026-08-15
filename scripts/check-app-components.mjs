#!/usr/bin/env node
/**
 * The app starter's shadcn set must reach the canonical @/components/ui
 * path. The template keeps it under the registry path it was generated with
 * (src/registry/new-york-v4/ui), which no model reaches for unaided — the
 * visible symptom was every generated app hand-rolling primitives in raw
 * Tailwind.
 *
 * A script rather than a test suite, per this repo's `pnpm check` convention.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const scaffold = read('backend/src/project/scaffold.ts');
const scenarios = read('backend/src/project/scenarios.ts');

// ── Scaffold puts the set at the canonical path ────────────────────
assert.match(
  scaffold,
  /registry\/new-york-v4\/ui/,
  'appStarterExtras no longer sources the shadcn set from the registry path'
);
assert.match(
  scaffold,
  /src\/components\/ui\/\$\{rel\}/,
  'appStarterExtras no longer maps the set to src/components/ui'
);

// ── The agent is told to use it ────────────────────────────────────
const appScenario = scenarios.match(
  /id: 'app',[\s\S]*?guidance: `([\s\S]*?)`,\n  \},/
);
assert.ok(appScenario, 'the app scenario is gone or lost its guidance');
assert.match(
  appScenario[1],
  /@\/components\/ui/,
  "the app guidance never names @/components/ui — the agent won't find the set"
);
assert.match(
  appScenario[1],
  /never|Never/,
  'the guidance no longer forbids hand-rolling primitives'
);

console.log('ok — app projects get shadcn at @/components/ui, and the agent knows');
