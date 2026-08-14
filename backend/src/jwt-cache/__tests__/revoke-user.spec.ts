import { JwtCacheService } from '../jwt-cache.service';

/**
 * The guard admits an access token only while this cache holds it, so
 * deleting a user's rows is what actually ends their live sessions.
 */
describe('removeTokensForUser', () => {
  let cache: JwtCacheService;

  beforeEach(async () => {
    // The service now also sweeps expired refresh_token rows on its interval;
    // nothing here touches that repository, and the interval is not running
    // during these tests.
    cache = new JwtCacheService({ delete: async () => ({}) } as never);
    await cache.onModuleInit();
  });

  afterEach(async () => {
    await cache.onModuleDestroy();
  });

  it('kills every session of one user and nobody else’s', async () => {
    await cache.storeAccessToken('phone', 'alice');
    await cache.storeAccessToken('laptop', 'alice');
    await cache.storeAccessToken('bob-token', 'bob');

    expect(await cache.removeTokensForUser('alice')).toBe(2);

    // Both of Alice's, instantly — not at expiry.
    expect(await cache.isTokenStored('phone')).toBe(false);
    expect(await cache.isTokenStored('laptop')).toBe(false);
    // Bob was signed in the whole time and stays signed in.
    expect(await cache.isTokenStored('bob-token')).toBe(true);
  });

  it('a login after the revoke works normally', async () => {
    await cache.storeAccessToken('old', 'alice');
    await cache.removeTokensForUser('alice');

    // This is the reset-then-sign-in case: revocation must not poison the
    // account, only the tokens that existed when it happened.
    await cache.storeAccessToken('new', 'alice');
    expect(await cache.isTokenStored('new')).toBe(true);
    expect(await cache.isTokenStored('old')).toBe(false);
  });

  it('reports how many it ended, so a caller can tell none from some', async () => {
    expect(await cache.removeTokensForUser('nobody')).toBe(0);
    expect(await cache.removeTokensForUser('')).toBe(0);
  });

  it('leaves tokens stored without a user alone', async () => {
    // Older rows predate the column; a revoke must not sweep every session
    // in the process by matching them.
    await cache.storeAccessToken('anonymous');
    expect(await cache.removeTokensForUser('alice')).toBe(0);
    expect(await cache.isTokenStored('anonymous')).toBe(true);
  });
});
