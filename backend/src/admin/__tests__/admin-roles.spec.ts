import { BadRequestException, NotFoundException } from '@nestjs/common';

// AdminService reaches the sandbox provider for the project listing's `onDisk`
// column, and that package is ESM-only — importing it under ts-jest's CJS
// transform is a syntax error before a single test runs. Nothing under test
// here touches it.
jest.mock('../../chat/sandbox-provider', () => ({
  sandboxMode: () => 'host',
}));
// Same again, one import further down: ai.constants pulls in @ai-sdk/openai
// for the overview's model name. Also untouched by these tests.
jest.mock('../../common/constants/ai.constants', () => ({
  DEFAULT_MODEL: 'test-model',
}));
// ProjectService is a constructor dependency, so `emitDecoratorMetadata` makes
// it a real runtime import — and it pulls in `ai`. The tests below pass a stub
// for it; this only stops the module graph at the door.
jest.mock('../../project/project.service', () => ({ ProjectService: class {} }));
jest.mock('../../project/preview.service', () => ({ PreviewService: class {} }));

import type { AdminService as AdminServiceType } from '../admin.service';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { AdminService, clampLimit, PAGE_SIZE } = require('../admin.service');

/**
 * The role editor's refusals, and the page-size ceiling.
 *
 * These are the branches that only fire when someone is about to do damage,
 * which no ordinary run reaches: an admin revoking their own Admin role has no
 * way back — there is no other grant path in the product, so recovery means
 * hand-written SQL against production.
 *
 * The repositories are stubs because the logic under test is the guard, not
 * the query. The listing paths are covered by their own real-query assertions
 * in the E2E suite.
 */
describe('AdminService role editing', () => {
  const ADMIN_ROLE = { id: 'role-admin', name: 'Admin' };
  const ME = 'user-me';
  const OTHER = 'user-other';

  let service: AdminServiceType;
  let saved: any;

  const build = (userRoles: any[] = []) => {
    saved = null;
    const users = {
      findOne: jest.fn(async ({ where }: any) =>
        where.id === ME || where.id === OTHER
          ? {
              id: where.id,
              email: `${where.id}@t.test`,
              isDeleted: false,
              isActive: true,
              roles: [...userRoles],
            }
          : null,
      ),
      save: jest.fn(async (user: any) => {
        saved = user;
        return user;
      }),
    };
    const roles = {
      findOne: jest.fn(async ({ where }: any) =>
        where.name === 'Admin' ? ADMIN_ROLE : null,
      ),
      find: jest.fn(async () => [ADMIN_ROLE, { id: 'r2', name: 'Editor' }]),
    };
    return new AdminService(
      {} as any,
      users as any,
      {} as any,
      roles as any,
      {} as any,
      {} as any,
    );
  };

  describe('the self-lockout guard', () => {
    it('refuses to revoke your own Admin role', async () => {
      service = build([ADMIN_ROLE]);
      await expect(
        service.setUserRole(ME, ME, 'Admin', false),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(saved).toBeNull();
    });

    it('refuses before it touches the database at all', async () => {
      // The guard is first, so a typo'd role name cannot turn the refusal
      // into a "no such role" that reads like the operation was allowed.
      service = build([ADMIN_ROLE]);
      await expect(service.setUserRole(ME, ME, 'Admin', false)).rejects.toThrow(
        /your own Admin role/,
      );
    });

    it('lets you revoke someone else’s Admin', async () => {
      service = build([ADMIN_ROLE]);
      await expect(service.setUserRole(ME, OTHER, 'Admin', false)).resolves.toBe(
        true,
      );
      expect(saved.roles).toHaveLength(0);
    });

    it('lets you grant yourself a non-Admin role', async () => {
      // Only Admin locks you out of the console; nothing else is a trap.
      service = build([]);
      await expect(service.setUserRole(ME, ME, 'Admin', true)).resolves.toBe(
        true,
      );
      expect(saved.roles).toContain(ADMIN_ROLE);
    });

    it('refuses to disable your own account', async () => {
      // Login rejects an inactive user, so this is the same lockout by a
      // different door.
      service = build([]);
      await expect(
        service.setUserActive(ME, ME, false),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('lets you re-enable yourself, which strands nobody', async () => {
      service = build([]);
      await expect(service.setUserActive(ME, ME, true)).resolves.toBe(true);
    });
  });

  describe('grant and revoke', () => {
    it('is idempotent — granting a held role saves nothing', async () => {
      // Two admins can click at once, and the console can double-click.
      service = build([ADMIN_ROLE]);
      await expect(service.setUserRole(ME, OTHER, 'Admin', true)).resolves.toBe(
        true,
      );
      expect(saved).toBeNull();
    });

    it('rejects a role the database does not have', async () => {
      service = build([]);
      await expect(
        service.setUserRole(ME, OTHER, 'Wizard', true),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects an unknown user', async () => {
      service = build([]);
      await expect(
        service.setUserRole(ME, 'ghost', 'Admin', true),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});

describe('clampLimit', () => {
  it('defaults when the caller names no limit', () => {
    expect(clampLimit(undefined)).toBe(PAGE_SIZE);
  });

  it('refuses to be talked into dumping the table', () => {
    // The limit reaches a query, and this endpoint can read every user in the
    // deployment.
    expect(clampLimit(100_000)).toBe(100);
  });

  it('treats nonsense as the default rather than as "no limit"', () => {
    for (const bad of [0, -1, NaN, Infinity]) {
      expect(clampLimit(bad)).toBe(PAGE_SIZE);
    }
  });

  it('keeps a sensible page size', () => {
    expect(clampLimit(10)).toBe(10);
    expect(clampLimit(25.7)).toBe(25);
  });
});
