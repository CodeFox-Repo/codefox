import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { parseNameStatus, parsePorcelain, mergeChanges } from '../workspace';

const exec = promisify(execFile);

/**
 * Against real git, because the bug IS git behaviour: `changedFiles()` diffs
 * the working tree against the ROOT commit, so once a turn commits it keeps
 * reporting the agent's own output forever. The pre-turn hand-edit list used
 * it, so from the second turn on every project told the agent "the user
 * edited these files themselves" about files the agent had written — next to
 * an instruction to keep what the user did unless asked to undo it.
 */
describe('pending edits are the working tree, not the diff from the starter', () => {
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
    dir = await mkdtemp(path.join(tmpdir(), 'cf-pending-'));
    await git('init', '-q');
    await writeFile(path.join(dir, 'index.html'), 'starter');
    await git('add', '-A');
    await git('commit', '-q', '-m', 'starter baseline', '--no-gpg-sign');
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  /** What changedFiles() answers, both workspaces implementing it the same. */
  const changedFiles = async () => {
    const { stdout: base } = await git('rev-list', '--max-parents=0', 'HEAD');
    const root = base.trim().split('\n')[0];
    const [committed, working] = await Promise.all([
      git('diff', '--name-status', root, 'HEAD'),
      git('status', '--porcelain'),
    ]);
    return mergeChanges(
      parseNameStatus(committed.stdout),
      parsePorcelain(working.stdout),
    );
  };

  /** What pendingEdits() answers: the working tree alone. */
  const pendingEdits = async () =>
    parsePorcelain((await git('status', '--porcelain')).stdout);

  /** One agent turn: it writes, then the turn snapshot commits. */
  const agentTurn = async (contents: string) => {
    await writeFile(path.join(dir, 'index.html'), contents);
    await git('add', '-A');
    await git('commit', '-q', '-m', 'Agent turn', '--no-gpg-sign');
  };

  it('reports nothing when the user has not touched anything — the bug', async () => {
    await agentTurn('the agent built this');

    // changedFiles() still names the agent's own file: it differs from the
    // starter, which is a true statement about a different question.
    expect((await changedFiles()).map((c) => c.path)).toEqual(['index.html']);

    // The turn is committed, so there is nothing of the user's to report.
    expect(await pendingEdits()).toEqual([]);
  });

  it('still reports a real hand edit', async () => {
    await agentTurn('the agent built this');
    await writeFile(path.join(dir, 'index.html'), 'the user fixed a typo');

    expect(await pendingEdits()).toEqual([
      { path: 'index.html', status: 'modified' },
    ]);
  });

  it('reports a file the user created by hand', async () => {
    await agentTurn('the agent built this');
    await writeFile(path.join(dir, 'about.html'), 'written by the user');

    expect(await pendingEdits()).toEqual([
      { path: 'about.html', status: 'added' },
    ]);
  });

  it('stays empty across several turns, which is where the noise compounded', async () => {
    await agentTurn('turn one');
    await agentTurn('turn two');
    await agentTurn('turn three');

    expect(await pendingEdits()).toEqual([]);
    // The old source of the claim keeps growing regardless.
    expect((await changedFiles()).length).toBeGreaterThan(0);
  });
});
