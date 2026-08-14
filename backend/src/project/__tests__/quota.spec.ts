import {
  DEFAULT_MAX_PROJECTS,
  assertCanCreateProject,
  maxProjectsPerUser,
} from '../quota';

/** Only `count` is used; a real repository here would test TypeORM. */
const repo = (count: number) =>
  ({ count: async () => count }) as any;

describe('project quota', () => {
  afterEach(() => {
    delete process.env.MAX_PROJECTS_PER_USER;
  });

  it('allows a user below the limit', async () => {
    await expect(
      assertCanCreateProject(repo(DEFAULT_MAX_PROJECTS - 1), 'u1'),
    ).resolves.toBeUndefined();
  });

  it('refuses at the limit, and says the limit, the count and the way out', async () => {
    await expect(
      assertCanCreateProject(repo(DEFAULT_MAX_PROJECTS), 'u1'),
    ).rejects.toThrow(/20 projects.*limit of 20.*Delete one/s);
  });

  it('lets an existing over-limit user keep what they have, but blocks the next', async () => {
    // Nothing deletes their projects; only creation is refused.
    await expect(assertCanCreateProject(repo(99), 'u1')).rejects.toThrow(
      /You have 99 projects/,
    );
  });

  it('frees a slot as soon as one is deleted', async () => {
    // The count is live (isDeleted: false), so this is just "one fewer".
    await expect(
      assertCanCreateProject(repo(DEFAULT_MAX_PROJECTS - 1), 'u1'),
    ).resolves.toBeUndefined();
  });

  it('does not cap an admin', async () => {
    await expect(
      assertCanCreateProject(repo(9999), 'u1', [{ name: 'Admin' }]),
    ).resolves.toBeUndefined();
  });

  it('still caps a non-admin role', async () => {
    await expect(
      assertCanCreateProject(repo(DEFAULT_MAX_PROJECTS), 'u1', [
        { name: 'User' },
      ]),
    ).rejects.toThrow(/limit of 20/);
  });

  it('reads the env override', async () => {
    process.env.MAX_PROJECTS_PER_USER = '2';
    expect(maxProjectsPerUser()).toBe(2);
    await expect(assertCanCreateProject(repo(2), 'u1')).rejects.toThrow(
      /limit of 2/,
    );
    await expect(assertCanCreateProject(repo(1), 'u1')).resolves.toBeUndefined();
  });

  it('a broken env value means the default, never "no limit"', async () => {
    for (const bad of ['', 'lots', '0', '-5']) {
      process.env.MAX_PROJECTS_PER_USER = bad;
      expect(maxProjectsPerUser()).toBe(DEFAULT_MAX_PROJECTS);
    }
  });
});
