import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);

/**
 * Against a real git repo, because the bug WAS git behaviour.
 *
 * `git checkout <sha> -- .` only writes the paths that <sha> contains. A file
 * the agent added after that version is not in its tree, so checkout has
 * nothing to say about it and leaves it on disk — the restore silently kept
 * every later addition. For a page-shaped project that is the whole product:
 * "take me back to before the about page" left about.html sitting there, and
 * the nav link the restored index.html no longer had.
 *
 * `read-tree -u --reset <sha>` makes the tree BE that version — additions
 * since are removed, deletions since come back — while leaving HEAD alone, so
 * the restore still lands as a reviewable change on a linear history.
 */
describe('restore makes the tree match the version', () => {
  let dir: string;
  let baseline: string;

  const git = (...args: string[]) =>
    exec('git', ['-C', dir, ...args], {
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'T',
        GIT_AUTHOR_EMAIL: 't@t',
        GIT_COMMITTER_NAME: 'T',
        GIT_COMMITTER_EMAIL: 't@t',
      },
    });

  // `readdir(recursive)` returning relative path strings works on every Node
  // this repo supports. Dirent.parentPath does not — it landed in 20.12, and
  // CI runs 18, where it is `undefined` and path.join then throws.
  // It yields directories too, so stat to keep only files.
  const files = async () => {
    const entries = (await readdir(dir, { recursive: true })).filter(
      (p) => !p.startsWith('.git'),
    );
    const out: string[] = [];
    for (const entry of entries) {
      if ((await stat(path.join(dir, entry))).isFile()) out.push(entry);
    }
    return out.sort();
  };

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'cf-restore-'));
    await git('init', '-q');
    await writeFile(path.join(dir, 'index.html'), 'v1');
    await mkdir(path.join(dir, 'assets'));
    await writeFile(path.join(dir, 'assets/site.css'), 'body{}');
    await git('add', '-A');
    await git('commit', '-q', '-m', 'starter baseline', '--no-gpg-sign');
    baseline = (await git('rev-parse', 'HEAD')).stdout.trim();

    // One agent turn: rewrite the page, add a second page, drop the stylesheet.
    await writeFile(path.join(dir, 'index.html'), 'v2 with a nav link');
    await writeFile(path.join(dir, 'about.html'), 'about');
    await rm(path.join(dir, 'assets/site.css'));
    await git('add', '-A');
    await git('commit', '-q', '-m', 'add an about page', '--no-gpg-sign');
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('the old checkout left the later addition behind — the bug', async () => {
    await git('checkout', baseline, '--', '.');
    expect(await files()).toContain('about.html');
  });

  it('removes what the version did not have', async () => {
    await git('read-tree', '-u', '--reset', baseline);
    expect(await files()).toEqual(['assets/site.css', 'index.html']);
  });

  it('brings back what the version did have', async () => {
    await git('read-tree', '-u', '--reset', baseline);
    const { stdout } = await exec('cat', [path.join(dir, 'index.html')]);
    expect(stdout).toBe('v1');
  });

  it('leaves HEAD where it was, so history stays linear', async () => {
    const before = (await git('rev-parse', 'HEAD')).stdout.trim();
    await git('read-tree', '-u', '--reset', baseline);
    expect((await git('rev-parse', 'HEAD')).stdout.trim()).toBe(before);
    // And the difference is staged, so the follow-up snapshot has something
    // to commit — without that the restore would leave no version to undo it.
    expect((await git('status', '--porcelain')).stdout.trim()).not.toBe('');
  });

  it('spares untracked and ignored files, which were never in the version', async () => {
    // node_modules is the expensive one: reinstalling it would cost minutes,
    // and it was never part of any version to begin with.
    await writeFile(path.join(dir, '.gitignore'), 'node_modules/\n');
    await mkdir(path.join(dir, 'node_modules'));
    await writeFile(path.join(dir, 'node_modules/dep.js'), 'x');
    await writeFile(path.join(dir, 'scratch.txt'), 'unsaved');

    await git('read-tree', '-u', '--reset', baseline);

    const after = await files();
    expect(after).toContain('node_modules/dep.js');
    expect(after).toContain('scratch.txt');
  });

  it('overwrites a file the user edited by hand rather than refusing', async () => {
    // `--reset` is what makes this a restore and not a merge: the pre-restore
    // snapshot is what keeps those edits reachable, not a failed checkout.
    await writeFile(path.join(dir, 'index.html'), 'typed in the editor');
    await git('read-tree', '-u', '--reset', baseline);
    const { stdout } = await exec('cat', [path.join(dir, 'index.html')]);
    expect(stdout).toBe('v1');
  });
});
