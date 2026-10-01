#!/usr/bin/env node
/**
 * CI must exercise the workspaces that actually exist. The old jobs built a
 * deleted package, installed an incompatible pnpm, and ran tsc without a
 * project. Keep those failures from hiding the product's checks again.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const workflows = Object.fromEntries(
  ['frontend-ci', 'backend-ci', 'autofix', 'codecov'].map((name) => [
    name,
    read(`.github/workflows/${name}.yml`),
  ])
);

for (const [name, source] of Object.entries(workflows)) {
  assert.match(
    source,
    /pnpm\/action-setup@v4/,
    `${name} uses an obsolete pnpm setup`
  );
  assert.doesNotMatch(
    source,
    /version: 8\b/,
    `${name} overrides the declared pnpm`
  );
  assert.match(
    source,
    /node-version: '22'/,
    `${name} cannot run the locked AI SDK`
  );
  assert.match(
    source,
    /pnpm install --frozen-lockfile/,
    `${name} ignores the lockfile`
  );
  assert.doesNotMatch(
    source,
    /codefox-common/,
    `${name} builds a deleted workspace`
  );
  for (const [, dir] of source.matchAll(/working-directory: (\S+)/g)) {
    assert.ok(
      existsSync(new URL(`../${dir}/package.json`, import.meta.url)),
      `${name}: ${dir} is not a workspace`
    );
  }
}

for (const name of ['frontend-ci', 'backend-ci']) {
  const source = workflows[name];
  for (const path of [
    'package.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    'patches/**',
    `.github/workflows/${name}.yml`,
  ]) {
    assert.ok(
      source.includes(`- '${path}'`),
      `${name} skips changes to ${path}`
    );
  }
  assert.match(
    source,
    /run: pnpm check/,
    `${name} no longer runs the source guards`
  );
}

const frontend = workflows['frontend-ci'];
assert.match(
  frontend,
  /configs=\(jest\.\*\.config\.js\)/,
  'focused frontend suites are not discovered'
);
assert.match(
  frontend,
  /for config in "\$\{configs\[@\]\}"/,
  'only one frontend suite is run'
);
assert.match(
  frontend,
  /pnpm exec jest --config "\$config" --runInBand/,
  'focused frontend suites are not executed'
);

const autofix = workflows.autofix;
for (const workspace of ['frontend', 'backend']) {
  assert.ok(
    autofix.includes(
      `pnpm exec tsc --project ${workspace}/tsconfig.json --noEmit`
    ),
    `autofix skips the ${workspace} typecheck`
  );
}
assert.doesNotMatch(
  autofix,
  /continue-on-error/,
  'autofix hides a failed check'
);
assert.match(
  autofix,
  /git diff --name-only --diff-filter=ACMR -z "\$BASE_SHA\.\.\.\$HEAD_SHA"/,
  'autofix no longer scopes files to the pull request'
);
assert.match(
  autofix,
  /prettier --write --ignore-unknown "\$\{files\[@\]\}"/,
  'formatting includes unrelated files'
);
assert.match(
  autofix,
  /eslint --resolve-plugins-relative-to backend --fix "\$\{files\[@\]\}"/,
  'lint fixes include unrelated files'
);
assert.doesNotMatch(autofix, /git add \./, 'autofix stages unrelated changes');

console.log(
  'ok — CI targets current workspaces, locked tools, source guards and focused tests'
);
