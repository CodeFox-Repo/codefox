import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);

/**
 * Against a real git repo, because the bug WAS git behaviour: the old guard
 * asked `changedFiles()`, which diffs the working tree against the ROOT
 * commit. After any turn that is still non-empty while the tree is clean vs
 * HEAD, so the guard passed and `git commit` then exited 1 with "nothing to
 * commit" — swallowed, returning null. Callers read that as "nothing to
 * snapshot" and carried on; restyle overwrote the page with no version to
 * return to. A mocked git cannot reproduce that.
 */
describe('snapshot guards on working-tree dirtiness', () => {
  let dir: string;
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

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'cf-snap-'));
    await git('init', '-q');
    await writeFile(path.join(dir, 'index.html'), 'v1');
    await git('add', '-A');
    await git('commit', '-q', '-m', 'starter baseline', '--no-gpg-sign');
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  /** What changedFiles() answers: diff against the ROOT commit + working tree. */
  const changedVsRoot = async () => {
    const { stdout: base } = await git('rev-list', '--max-parents=0', 'HEAD');
    const root = base.trim().split('\n')[0];
    const [committed, working] = await Promise.all([
      git('diff', '--name-status', root, 'HEAD'),
      git('status', '--porcelain'),
    ]);
    return (committed.stdout + working.stdout).trim();
  };

  const dirty = async () => (await git('status', '--porcelain')).stdout.trim();

  it('the old guard passes while the tree is clean — the bug', async () => {
    // One turn: edit, commit. Exactly the state every project is in after the
    // agent finishes.
    await writeFile(path.join(dir, 'index.html'), 'v2');
    await git('add', '-A');
    await git('commit', '-q', '-m', 'a turn', '--no-gpg-sign');

    expect(await changedVsRoot()).not.toBe(''); // old guard: "something changed"
    expect(await dirty()).toBe(''); // new guard: nothing to commit

    // And committing here is exactly what failed, silently.
    await expect(git('commit', '-m', 'Before restyle', '--no-gpg-sign')).rejects.toThrow();
  });

  it('the new guard still fires when there is real work to save', async () => {
    await writeFile(path.join(dir, 'index.html'), 'edited by hand');
    expect(await dirty()).not.toBe('');
    await git('add', '-A');
    await git('commit', '-q', '-m', 'Before restyle', '--no-gpg-sign');
    const { stdout } = await git('log', '--oneline');
    expect(stdout).toContain('Before restyle');
  });
});
