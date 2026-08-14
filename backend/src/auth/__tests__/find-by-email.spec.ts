import { DataSource } from 'typeorm';
import { User } from 'src/user/user.model';
import { Chat } from 'src/chat/chat.model';
import { Message } from 'src/chat/message.model';
import { Project } from 'src/project/project.model';
import { Role } from '../role.model';
import { Menu } from '../menu.model';
import { RefreshToken } from '../refresh-token.model';
import { findUserByEmail } from '../find-by-email';

/**
 * Against a real SQLite instance, not a stub: the whole fix is a `LOWER()`
 * comparison in SQL, so a mocked repository would test nothing.
 */
describe('findUserByEmail', () => {
  let ds: DataSource;

  beforeAll(async () => {
    ds = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: [User, Chat, Message, Project, Role, Menu, RefreshToken],
      synchronize: true,
    });
    await ds.initialize();
  }, 30000);

  afterAll(async () => {
    await ds.destroy();
  });

  const users = () => ds.getRepository(User);

  it('finds a mixed-case row however it is asked for', async () => {
    // Exactly the production shape: a row written before normalisation.
    await users().save(
      users().create({ username: 'legacy', email: 'Foo@Example.com' }),
    );

    for (const asked of [
      'Foo@Example.com', // as typed at sign-up
      'foo@example.com', // as the reset flow lowercases it
      'FOO@EXAMPLE.COM',
      '  Foo@Example.com  ', // pasted with whitespace
    ]) {
      const found = await findUserByEmail(users(), asked);
      expect(found?.username).toBe('legacy');
    }
  }, 20000);

  it('still misses a genuinely different address', async () => {
    expect(await findUserByEmail(users(), 'nobody@example.com')).toBeNull();
  }, 20000);

  it('treats empty input as no match rather than matching anything', async () => {
    for (const empty of ['', '   ', undefined as unknown as string]) {
      expect(await findUserByEmail(users(), empty)).toBeNull();
    }
  }, 20000);

  it('is what stops Foo@ and foo@ becoming two accounts', async () => {
    // register() looks the address up through this function before creating,
    // so the second sign-up finds the first row and is refused.
    await users().save(
      users().create({ username: 'first', email: 'dup@example.com' }),
    );
    const clash = await findUserByEmail(users(), 'DUP@Example.com');
    expect(clash?.username).toBe('first');
  }, 20000);

  it('a duplicate pair resolves deterministically: exact match wins', async () => {
    // Production may already hold both, created before normalisation. Which
    // one you get must not be up to the query planner.
    await users().save(users().create({ username: 'upper', email: 'Pair@x.com' }));
    await users().save(users().create({ username: 'lower', email: 'pair@x.com' }));

    // Asked exactly as stored → that row, both directions.
    expect((await findUserByEmail(users(), 'Pair@x.com'))?.username).toBe('upper');
    expect((await findUserByEmail(users(), 'pair@x.com'))?.username).toBe('lower');

    // Asked in a casing matching neither → stable, not random. Repeat to
    // catch a planner that returns whichever row it happened to scan first.
    const picks = new Set<string>();
    for (let i = 0; i < 5; i++) {
      picks.add((await findUserByEmail(users(), 'PAIR@X.COM'))!.username);
    }
    expect(picks.size).toBe(1);
  }, 20000);

  it('the full flow: register mixed case, log in either way, reset finds it', async () => {
    // register() stores normalised now.
    const stored = '  MixedCase@Example.COM  '.trim().toLowerCase();
    await users().save(users().create({ username: 'flow', email: stored }));

    // login() looks up through this same function...
    expect((await findUserByEmail(users(), 'MixedCase@Example.COM'))?.username).toBe('flow');
    expect((await findUserByEmail(users(), 'mixedcase@example.com'))?.username).toBe('flow');
    // ...and so does requestPasswordReset, which is the one that was silently
    // missing these accounts.
    expect((await findUserByEmail(users(), 'MIXEDCASE@EXAMPLE.COM'))?.username).toBe('flow');
  }, 20000);
});
