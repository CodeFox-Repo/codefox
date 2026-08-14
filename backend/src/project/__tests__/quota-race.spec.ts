import { ForbiddenException } from '@nestjs/common';
import { assertCanCreateProject, DEFAULT_MAX_PROJECTS } from '../quota';
import { queueForUser } from '../project-queue';

/**
 * The cap is a COUNT, and the row it authorises is INSERTed several awaits
 * later — a model call for the generated title in create's case, seconds
 * wide. Two requests inside that window both counted 19 of 20 and both
 * created, so N concurrent requests put a user N-1 over the cap. Fork had the
 * same shape with a narrower window, and clicking Fork twice is easier than
 * racing a create.
 *
 * The fix is not a smaller window — it is doing the count and the save in one
 * queued turn per user.
 */
describe('the project cap survives concurrent creates', () => {
  /** A repository whose count reflects rows saved so far. */
  const store = (rows: number) => {
    let saved = rows;
    return {
      count: async () => saved,
      save: async () => {
        saved += 1;
        return { id: `p${saved}` };
      },
      get total() {
        return saved;
      },
    };
  };

  /** What a request does: authorise, then (slowly) save. */
  const create = async (repo: any, queued: boolean) => {
    const work = async () => {
      await assertCanCreateProject(repo as never, 'u1');
      // The model call / createChat that made the window wide.
      await new Promise((r) => setImmediate(r));
      await repo.save();
    };
    return queued ? queueForUser('u1', work) : work();
  };

  const settle = (results: PromiseSettledResult<unknown>[]) => ({
    created: results.filter((r) => r.status === 'fulfilled').length,
    refused: results.filter((r) => r.status === 'rejected').length,
  });

  it('lets exactly one through when one slot is left', async () => {
    const repo = store(DEFAULT_MAX_PROJECTS - 1);

    const results = await Promise.allSettled([
      create(repo, true),
      create(repo, true),
      create(repo, true),
    ]);

    expect(settle(results)).toEqual({ created: 1, refused: 2 });
    expect(repo.total).toBe(DEFAULT_MAX_PROJECTS);
  });

  it('is the queue doing it — unqueued, all three get through', async () => {
    // The bug, so this test fails if the fix is only apparently working.
    const repo = store(DEFAULT_MAX_PROJECTS - 1);

    await Promise.allSettled([
      create(repo, false),
      create(repo, false),
      create(repo, false),
    ]);

    expect(repo.total).toBeGreaterThan(DEFAULT_MAX_PROJECTS);
  });

  it('refuses every one when already at the cap', async () => {
    const repo = store(DEFAULT_MAX_PROJECTS);

    const results = await Promise.allSettled([
      create(repo, true),
      create(repo, true),
    ]);

    expect(settle(results)).toEqual({ created: 0, refused: 2 });
    expect(
      results[0].status === 'rejected' && results[0].reason,
    ).toBeInstanceOf(ForbiddenException);
  });

  it('does not serialise different users against each other', async () => {
    const a = store(0);
    const b = store(0);
    await Promise.all([create(a, true), create(b, true)]);
    expect([a.total, b.total]).toEqual([1, 1]);
  });

  it('a failed creation frees the queue for the next one', async () => {
    const repo = store(0);
    await expect(
      queueForUser('u1', async () => {
        throw new Error('scaffold exploded');
      }),
    ).rejects.toThrow('scaffold exploded');

    await create(repo, true);
    expect(repo.total).toBe(1);
  });
});
