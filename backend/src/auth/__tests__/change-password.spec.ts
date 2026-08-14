import { hash, compare } from 'bcrypt';
import { AuthService } from '../auth.service';

/**
 * changePassword against stubs: the repository and the two token stores are
 * the only collaborators that matter, and standing up Nest DI for four
 * assertions is more machinery than the assertions.
 */
function makeService(user: any) {
  const saved: any[] = [];
  const revoked: string[] = [];
  const stored: Array<[string, string]> = [];

  const service = new AuthService(
    {
      findOne: async ({ where }: any) => (where.id === user?.id ? user : null),
      save: async (u: any) => {
        saved.push({ ...u });
        return u;
      },
    } as any,
    { sign: () => 'new.access.token' } as any,
    {
      storeAccessToken: async (t: string, id: string) => {
        stored.push([t, id]);
      },
      removeTokensForUser: async (id: string) => {
        revoked.push(id);
        return 1;
      },
    } as any,
    { isMailEnabled: false, jwtSecret: 's', frontendUrl: 'http://x' } as any,
    {} as any,
    {} as any,
    {} as any,
    {
      delete: async () => ({}),
      create: (v: any) => v,
      save: async (v: any) => ({ ...v, token: 'new.refresh.token' }),
    } as any,
  );
  return { service, saved, revoked, stored };
}

describe('changePassword', () => {
  const ID = 'user-1';

  it('refuses a wrong current password, and changes nothing', async () => {
    const user = { id: ID, email: 'a@b.c', password: await hash('right', 10) };
    const { service, saved, revoked } = makeService(user);

    await expect(service.changePassword(ID, 'wrong', 'longenough1')).rejects.toThrow(
      /current password is incorrect/i,
    );
    // The important half: a failed attempt must not save, and must not sign
    // the user out of anything.
    expect(saved).toHaveLength(0);
    expect(revoked).toHaveLength(0);
  }, 20000);

  it('changes the password, ends other sessions, and re-admits this device', async () => {
    const user = { id: ID, email: 'a@b.c', password: await hash('right', 10) };
    const { service, revoked, stored } = makeService(user);

    const tokens = await service.changePassword(ID, 'right', 'longenough1');

    // Actually hashed, not stored raw.
    expect(user.password).not.toBe('longenough1');
    expect(await compare('longenough1', user.password)).toBe(true);
    // Old sessions dead...
    expect(revoked).toEqual([ID]);
    // ...but this device gets a working pair back rather than being kicked.
    expect(tokens.accessToken).toBe('new.access.token');
    // A real refresh token (randomUUID, minted by createRefreshToken), not
    // the one that was just revoked.
    expect(tokens.refreshToken).toMatch(/^[0-9a-f-]{36}$/);
    // And the new token is revocable in turn — it carries the user id.
    expect(stored).toEqual([['new.access.token', ID]]);
  }, 20000);

  it('refuses a too-short new password even when the current one is right', async () => {
    const user = { id: ID, email: 'a@b.c', password: await hash('right', 10) };
    const { service, revoked } = makeService(user);

    await expect(service.changePassword(ID, 'right', 'short')).rejects.toThrow(
      /at least 8/i,
    );
    expect(revoked).toHaveLength(0);
  }, 20000);

  it('tells a Google account there is nothing to change', async () => {
    // No password column: comparing against it would throw, and offering a
    // form that can only fail is the thing this branch exists to prevent.
    const user = { id: ID, email: 'a@b.c', password: null };
    const { service } = makeService(user);

    await expect(service.changePassword(ID, 'anything', 'longenough1')).rejects.toThrow(
      /google/i,
    );
    expect(await service.hasPassword(ID)).toBe(false);
  }, 20000);

  it('hasPassword is true for a normal account', async () => {
    const user = { id: ID, email: 'a@b.c', password: await hash('right', 10) };
    const { service } = makeService(user);
    expect(await service.hasPassword(ID)).toBe(true);
  }, 20000);
});
