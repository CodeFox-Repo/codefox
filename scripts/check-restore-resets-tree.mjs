import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(p, 'utf8');

// `git checkout <sha> -- .` only writes the paths that <sha> contains, so a
// file added after that version survived a restore meant to predate it. Both
// workspaces had the same line; a regression in either one is invisible from
// the other's tests, and the sandbox path has no unit test at all because it
// runs its git over a network shell.
for (const [path, what] of [
  ['backend/src/project/host-workspace.ts', 'host'],
  ['backend/src/project/vercel-workspace.ts', 'sandbox'],
]) {
  const src = read(path);
  const restore = src.slice(src.indexOf('async restore('));
  assert.ok(restore, `${what} workspace has no restore()`);

  assert.match(
    restore,
    /read-tree[\s\S]{0,40}-u[\s\S]{0,40}--reset|read-tree', '-u', '--reset/,
    `${what} restore no longer resets the tree — files added after the ` +
      `restored version will survive it`
  );
  assert.doesNotMatch(
    restore,
    /checkout \$?\{?versionId\}? -- \.|'checkout', versionId, '--', '\.'/,
    `${what} restore is back on 'checkout <sha> -- .', which cannot remove ` +
      `a file the version never had`
  );

  // The pre-restore snapshot is the only thing standing between a restore and
  // losing whatever the user typed in the editor since the last turn.
  assert.ok(
    restore.indexOf("snapshot('Before restore')") !== -1 &&
      restore.indexOf("snapshot('Before restore')") <
        restore.indexOf('read-tree'),
    `${what} restore no longer snapshots before overwriting the tree`
  );
  // And the one after is what gives the user a version to undo the restore
  // with — read-tree stages the difference, so there is something to commit.
  assert.match(
    restore,
    /snapshot\(`Restored to \$\{versionId\.slice\(0, 7\)\}`\)/,
    `${what} restore no longer records itself as a version`
  );
}

// The restore rewrites the tree the way a turn does, so the panels keyed off a
// finished turn have to repaint — otherwise the file tree keeps listing a file
// the restore just removed.
const tab = read('frontend/src/components/chat/code-engine/tabs/code-tab.tsx');
assert.match(
  tab,
  /await loadVersions\(\);[\s\S]{0,400}?turnFinished\?\.\(\)/,
  'a successful restore no longer signals a finished turn — the file tree ' +
    'and the cover go stale'
);

// That signal is only worth raising if something refetches the tree on it. The
// original effect fires only while the tree is empty, so once loaded it never
// refetched at all.
const engine = read('frontend/src/components/chat/code-engine/code-engine.tsx');
assert.match(
  engine,
  /treeAt\.current === turnsDone[\s\S]{0,200}?fetchFiles\(\)/,
  'the file tree no longer refetches when a turn (or a restore) finishes'
);

console.log('ok — restore resets the tree, and the panels follow it');
