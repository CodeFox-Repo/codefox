import { LessThan } from 'typeorm';
import { JwtCacheService } from '../jwt-cache.service';

/**
 * One refresh_token row is written per login and deleted only on an explicit
 * logout — so closing the browser, letting a token expire, and every OAuth
 * round trip each leaked a row permanently. Measured before this sweep: 251
 * rows for 130 users, 200 of them (80%) already past expiry, worst single
 * user 64 rows.
 *
 * The sweep rides this service's existing 5-minute interval rather than a
 * scheduler, so what matters is (a) the predicate only matches expired rows,
 * and (b) a failure in it cannot take the interval or the jwt_cache sweep
 * down with it.
 */
describe('expired refresh tokens are swept', () => {
  jest.useFakeTimers();

  const repo = {
    delete: jest.fn(async (_where: any) => ({ affected: 0 })),
  };
  let cache: JwtCacheService;

  beforeEach(async () => {
    repo.delete.mockClear();
    cache = new JwtCacheService(repo as never);
    await cache.onModuleInit();
  });

  afterEach(async () => {
    await cache.onModuleDestroy();
  });

  const sweep = async () => {
    jest.advanceTimersByTime(5 * 60 * 1000);
    // Let the two sweeps' promises settle.
    await Promise.resolve();
    await Promise.resolve();
  };

  it('deletes by expiry, and only by expiry', async () => {
    await sweep();

    expect(repo.delete).toHaveBeenCalledTimes(1);
    const where = repo.delete.mock.calls[0][0] as any;
    // The whole safety of a bulk delete is its predicate: anything other than
    // "expiresAt is in the past" would take live sessions with it.
    expect(Object.keys(where)).toEqual(['expiresAt']);
    expect(where.expiresAt).toEqual(LessThan(expect.any(Date)));
  });

  it('asks for rows already past their expiry, not future ones', async () => {
    const before = Date.now();
    await sweep();
    const cutoff: Date = (repo.delete.mock.calls[0][0] as any).expiresAt.value;

    // A row expiring one second from now must NOT match the predicate.
    expect(cutoff.getTime()).toBeGreaterThanOrEqual(before);
    expect(cutoff.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('keeps sweeping after a failure, and does not take the process with it', async () => {
    repo.delete.mockRejectedValueOnce(new Error('database is gone'));

    // An unhandled rejection here would be fatal under Node's default policy.
    await expect(sweep()).resolves.toBeUndefined();

    await sweep();
    expect(repo.delete).toHaveBeenCalledTimes(2);
  });

  it('does not sweep before the interval comes round', async () => {
    jest.advanceTimersByTime(4 * 60 * 1000);
    expect(repo.delete).not.toHaveBeenCalled();
  });
});
