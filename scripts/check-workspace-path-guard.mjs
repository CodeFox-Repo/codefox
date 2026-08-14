import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';

/**
 * A project directory name must be one path segment, checked at the chokepoint.
 *
 * `HostWorkspace` derives `root = join(projectsDir, projectPath)` and then
 * validates every file path *relative to that root* — so a `projectPath`
 * carrying `..` moves the anchor itself, and every later containment check
 * passes against the escaped directory. `assertProjectAccess` does not close
 * it: it authorises `projectPath.split('/')[0]`, so "<a-project-you-own>/../.."
 * is approved on its first segment and traverses on the rest.
 *
 * `preview.controller.ts` carried the guard inline; `screenshot.controller.ts`
 * did not, and reached `file://<anywhere>/index.html` through it — rendering
 * any index.html on the box into a PNG the caller downloads. The guard now
 * lives in `WorkspaceService.for`, which all ~20 callers route through, so a
 * caller that forgets fails closed.
 *
 * A check script rather than a jest spec: workspace.service.ts transitively
 * imports @ai-sdk/sandbox-vercel, which is ESM-only and cannot be required by
 * this repo's jest — the same reason instructions.ts is its own module.
 */
const source = readFileSync('backend/src/project/workspace.service.ts', 'utf8');

const guard = source.match(
  /if \((![^)]*?projectPath[\s\S]*?)\) \{\s*throw new BadRequestException/
);
assert.ok(
  guard,
  'WorkspaceService.for no longer refuses a bad projectPath before use — a ' +
    "traversing directory name moves HostWorkspace's root anchor"
);

// The guard has to run before anything derives a path or hits the database.
const forBody = source.slice(source.indexOf('async for('));
assert.ok(
  forBody.indexOf('BadRequestException') < forBody.indexOf('new HostWorkspace'),
  'the guard runs after a workspace is already constructed'
);

// Re-implement the shipped predicate and exercise it, so this fails if the
// pattern is loosened rather than only if it is deleted.
const pattern = source.match(/\/\[\/\\\\\]\|\^\\\.\+\$\//)?.[0];
assert.ok(
  pattern,
  'the projectPath pattern changed shape — re-verify it still rejects ' +
    'separators and pure-dot names, then update this check'
);
const bad = (p) => !p || /[/\\]|^\.+$/.test(p);

for (const value of [
  '..',
  '.',
  '...',
  'proj/../../..',
  '../../etc',
  'proj/sub',
  '/abs',
  'proj\\..\\..',
  '',
]) {
  assert.ok(
    bad(value),
    `${JSON.stringify(value)} is accepted as a project path`
  );
}

// Real directory names must still work, or every project breaks.
for (const value of [
  '3f2a9c10-7b44-4e51-9d0e-1c5f8b6a2d33',
  'my-project',
  'a.b',
]) {
  assert.ok(
    !bad(value),
    `${JSON.stringify(value)} is refused but is legitimate`
  );
}

// Why the anchor must be guarded rather than clamped: the escape happens in
// the join that *produces* the root, before any check exists to clamp against.
assert.equal(path.join('/data/.codefox/projects', 'myproj/../../..'), '/data');

// And the caller that lacked its own guard must still route through here.
const screenshot = readFileSync(
  'backend/src/project/screenshot.controller.ts',
  'utf8'
);
assert.match(
  screenshot,
  /renderTarget\(projectPath: string\)[\s\S]*?this\.workspaces\.for\(projectPath\)/,
  'screenshot renderTarget no longer goes through WorkspaceService.for, which ' +
    'is where its path is validated'
);
const target = screenshot.slice(
  screenshot.indexOf('private async renderTarget')
);
assert.ok(
  target.indexOf('this.workspaces.for(projectPath)') <
    target.indexOf('file://'),
  'the raw file:// join now happens before the path is validated'
);

console.log(
  'ok — a project path is one segment, enforced where all callers meet'
);
