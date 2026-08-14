import {
  mkdtemp,
  mkdir,
  rm,
  readdir,
  writeFile,
  utimes,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';

// Same door-stops as admin-roles.spec.ts: AdminService's module graph reaches
// ESM-only packages that ts-jest's CJS transform cannot parse. Nothing under
// test here touches any of them.
jest.mock('../../chat/sandbox-provider', () => ({ sandboxMode: () => 'host' }));
jest.mock('../../common/constants/ai.constants', () => ({
  DEFAULT_MODEL: 'test-model',
}));
jest.mock('../../project/project.service', () => ({
  ProjectService: class {},
}));
jest.mock('../../project/preview.service', () => ({
  PreviewService: class {},
}));

const projectsDir = jest.fn();
jest.mock('../../common/utils/common-path', () => ({
  getProjectsDir: () => projectsDir(),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { AdminService } = require('../admin.service');

/**
 * Against a real directory tree, because the bug was a real one on disk: the
 * harness writes one directory per agent turn under `.agent-runs` and never
 * removes it, and the sweeper skipped it for being dotted — so the only
 * reclaimer we have stepped over the fastest-growing directory on the volume
 * while reporting `orphanDirs: 0`. Measured at 184 dirs / 8.5MB over 17 days
 * on a dev box; prod has been up since 2026-07-29.
 */
describe('sweepOrphans reclaims spent agent-run state', () => {
  let base: string;

  const service = () =>
    new AdminService(
      { find: async () => [] },
      {},
      {},
      {},
      { stop: async () => undefined },
      {},
      {},
    );

  /** One session's state, as the harness leaves it, aged by `days`. */
  const session = async (name: string, days: number) => {
    const dir = path.join(base, '.agent-runs', name);
    await mkdir(path.join(dir, 'bridge'), { recursive: true });
    await writeFile(path.join(dir, 'bridge', 'event-log.ndjson'), '{}\n');
    const when = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    await utimes(dir, when, when);
    return dir;
  };

  const remaining = () => readdir(path.join(base, '.agent-runs'));

  beforeEach(async () => {
    base = await mkdtemp(path.join(tmpdir(), 'cf-runs-'));
    projectsDir.mockReturnValue(base);
  });

  afterEach(async () => {
    await rm(base, { recursive: true, force: true });
  });

  it('removes spent sessions and keeps recent ones', async () => {
    await session('old-one', 3);
    await session('old-two', 30);
    await session('still-warm', 0);

    const removed = await service().sweepOrphans();

    expect(await remaining()).toEqual(['still-warm']);
    expect(removed).toBe(2);
  });

  it('counts mtime, so a resumed session is not swept', async () => {
    // Created days ago but written to just now — that is the one session
    // still in use, and birthtime would have thrown it away.
    const dir = await session('resumed', 5);
    const now = new Date();
    await utimes(dir, now, now);

    await service().sweepOrphans();

    expect(await remaining()).toEqual(['resumed']);
  });

  it('is a no-op when no agent has ever run', async () => {
    await expect(service().sweepOrphans()).resolves.toBe(0);
  });

  it('still reclaims orphaned project directories', async () => {
    // The behaviour that already existed must survive the addition.
    await mkdir(path.join(base, 'a-dead-project'));
    await session('old', 3);

    expect(await service().sweepOrphans()).toBe(2);
    expect(await readdir(base)).toEqual(['.agent-runs']);
  });
});
