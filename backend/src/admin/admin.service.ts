import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Chat } from 'src/chat/chat.model';
import { User } from 'src/user/user.model';
import { Role } from '../auth/role.model';
import { AuthService } from '../auth/auth.service';
import { getProjectsDir } from '../common/utils/common-path';
import { sandboxMode } from '../chat/sandbox-provider';
import { DEFAULT_MODEL } from '../common/constants/ai.constants';
import { DefaultRoles } from '../common/enums/role.enum';
import { Project } from '../project/project.model';
import { PreviewService } from '../project/preview.service';
import { ProjectService } from '../project/project.service';
import {
  AdminDisk,
  AdminOverview,
  AdminProjectPage,
  AdminUserPage,
} from './admin.model';

/** Directories the agent and its bridge leave behind, which are not projects. */
const NOT_A_PROJECT = /^(\.|codex-)/;

/**
 * The harness writes one directory per agent turn under `.agent-runs` and
 * never removes it, so it grows for the life of the volume — 184 dirs / 8.5MB
 * on this dev box over 17 days, and prod has been up since 2026-07-29. The
 * sweeper skipped it precisely because it is dotted, so the one reclaimer we
 * have stepped over the fastest-growing directory on disk while reporting
 * `orphanDirs: 0`.
 *
 * Age rather than a count: the contents are a session's event log, only
 * useful while that session might still be resumed, and a turn is minutes.
 *
 * ponytail: swept on the same admin action as orphan directories rather than
 * on a schedule. If it needs to be automatic, the preview reaper's interval
 * is the place to hang it.
 */
const AGENT_RUNS = '.agent-runs';
const AGENT_RUN_TTL_MS = 24 * 60 * 60 * 1000;

/** Rows per page. Both lists count chats per row, so a page is real work. */
export const PAGE_SIZE = 25;

/**
 * A page size the caller cannot use to ask for the whole table.
 *
 * The limit reaches a query, and this endpoint is the one place that can read
 * every user in the deployment — an unbounded `take` is how a pager becomes a
 * dump. NaN and 0 fall back to the default rather than to "no limit".
 */
export const clampLimit = (limit?: number): number =>
  !limit || !Number.isFinite(limit) || limit < 1
    ? PAGE_SIZE
    : Math.min(Math.floor(limit), 100);

@Injectable()
export class AdminService {
  private readonly logger = new Logger('AdminService');

  constructor(
    @InjectRepository(Project) private projects: Repository<Project>,
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(Chat) private chats: Repository<Chat>,
    @InjectRepository(Role) private roles: Repository<Role>,
    private previews: PreviewService,
    private projectService: ProjectService,
    private authService: AuthService,
  ) {}

  /**
   * Size of a directory tree.
   *
   * Walked rather than shelled out to `du`: this runs in a container whose
   * shell tooling is not guaranteed, and a failure here should cost a number
   * on a dashboard, not the whole request.
   */
  private async sizeOf(dir: string): Promise<number> {
    let total = 0;
    let entries: Awaited<ReturnType<typeof fs.readdir>>;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return 0;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) total += await this.sizeOf(full);
      else if (entry.isFile()) {
        try {
          total += (await fs.stat(full)).size;
        } catch {
          // Raced with a delete. Nothing to add.
        }
      }
    }
    return total;
  }

  private async diskReport(): Promise<AdminDisk> {
    const base = getProjectsDir();
    let dirs: string[] = [];
    try {
      dirs = (await fs.readdir(base, { withFileTypes: true }))
        .filter((e) => e.isDirectory() && !NOT_A_PROJECT.test(e.name))
        .map((e) => e.name);
    } catch {
      return { projectBytes: 0, projectDirs: 0, orphanDirs: 0 };
    }

    const live = new Set(
      (
        await this.projects.find({
          where: { isDeleted: false },
          select: ['projectPath'],
        })
      ).map((p) => p.projectPath),
    );

    return {
      projectBytes: await this.sizeOf(base),
      projectDirs: dirs.length,
      orphanDirs: dirs.filter((d) => !live.has(d)).length,
    };
  }

  async overview(): Promise<AdminOverview> {
    const [users, projects, chats, deletedProjects] = await Promise.all([
      this.users.count({ where: { isDeleted: false } }),
      this.projects.count({ where: { isDeleted: false } }),
      this.chats.count({ where: { isDeleted: false } }),
      this.projects.count({ where: { isDeleted: true } }),
    ]);

    const base = process.env.LLM_BASE_URL ?? 'https://openrouter.ai/api/v1';
    return {
      counts: { users, projects, chats, deletedProjects },
      runtime: {
        nodeEnv: process.env.NODE_ENV ?? 'development',
        model: DEFAULT_MODEL ?? 'unset',
        // The host is the identifying part and the only part safe to show —
        // a base url can carry a key in its query string.
        provider: (() => {
          try {
            return new URL(base).host;
          } catch {
            return base;
          }
        })(),
        sandbox: process.env.SANDBOX_PROVIDER ?? 'host',
        registrationOpen:
          process.env.NODE_ENV !== 'production' ||
          process.env.ALLOW_REGISTRATION === 'true',
        uptime: Math.round(process.uptime()),
      },
      disk: await this.diskReport(),
      previews: this.previews.running(),
    };
  }

  async listUsers(
    search?: string,
    offset = 0,
    limit = PAGE_SIZE,
  ): Promise<AdminUserPage> {
    // ILike is Postgres-only; SQLite (local dev, and the E2E suite) has no
    // such operator and errors. LOWER(col) LIKE LOWER(:q) is the one spelling
    // both accept, so the console behaves the same in both.
    const where = search?.trim()
      ? '(LOWER(user.email) LIKE :q OR LOWER(user.username) LIKE :q)'
      : '1=1';
    const params = { q: `%${search?.trim().toLowerCase() ?? ''}%` };

    const query = this.users
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.roles', 'role')
      .where('user.isDeleted = :deleted', { deleted: false })
      .andWhere(where, params)
      .orderBy('user.createdAt', 'DESC')
      .skip(offset)
      .take(clampLimit(limit));

    const [users, total] = await query.getManyAndCount();

    const chatCounts = await this.chatCounts(
      'user_id',
      users.map((u) => u.id),
    );
    return {
      total,
      items: await Promise.all(
        users.map(async (user) => ({
          id: user.id,
          email: user.email,
          username: user.username,
          isActive: user.isActive,
          roles: (user.roles ?? []).map((role) => role.name),
          projects: await this.projects.count({
            where: { userId: user.id, isDeleted: false },
          }),
          chats: chatCounts.get(user.id) ?? 0,
          createdAt: user.createdAt,
        })),
      ),
    };
  }

  /**
   * How many live chats each of these ids has, in one query.
   *
   * Was a `count()` per row inside the map: six admin rows meant six extra
   * queries, and the cost grew with the page. A grouped count is one.
   */
  private async chatCounts(
    // The two FKs genuinely differ: `chat.projectId` vs `chat.user_id`.
    column: 'projectId' | 'user_id',
    ids: string[],
  ): Promise<Map<string, number>> {
    if (!ids.length) return new Map();
    const rows = await this.chats
      .createQueryBuilder('chat')
      .select(`chat.${column}`, 'id')
      .addSelect('COUNT(*)', 'n')
      .where(`chat.${column} IN (:...ids)`, { ids })
      .andWhere('chat.isDeleted = :deleted', { deleted: false })
      .groupBy(`chat.${column}`)
      .getRawMany();
    return new Map(rows.map((r) => [r.id, Number(r.n)]));
  }

  /** The roles a console can hand out, so the UI does not invent names. */
  async listRoles(): Promise<string[]> {
    const roles = await this.roles.find({ order: { name: 'ASC' } });
    return roles.map((role) => role.name);
  }

  /**
   * Grant or revoke a role.
   *
   * The one refusal that is not about permissions: an admin removing their own
   * Admin role locks themselves out of the page they are standing on, and
   * nothing in the product can put it back — there is no other grant path, so
   * recovery means a hand-written SQL statement against production. Blocked on
   * identity, not on "is there another admin left": the second admin might be
   * a colleague who is asleep, and that is still a lockout.
   */
  async setUserRole(
    actingUserId: string,
    userId: string,
    roleName: string,
    granted: boolean,
  ): Promise<boolean> {
    if (
      !granted &&
      userId === actingUserId &&
      roleName === DefaultRoles.ADMIN
    ) {
      throw new BadRequestException(
        'You cannot remove your own Admin role — ask another admin to do it',
      );
    }

    const role = await this.roles.findOne({ where: { name: roleName } });
    if (!role) throw new NotFoundException('No such role');

    const user = await this.users.findOne({
      where: { id: userId },
      relations: ['roles'],
    });
    if (!user || user.isDeleted) throw new NotFoundException('No such user');

    const has = (user.roles ?? []).some((r) => r.id === role.id);
    // Idempotent: the console can double-click, and two admins can grant the
    // same role at once. Saving the same row twice is what would throw.
    if (has === granted) return true;

    user.roles = granted
      ? [...(user.roles ?? []), role]
      : (user.roles ?? []).filter((r) => r.id !== role.id);
    await this.users.save(user);
    this.logger.log(
      `Role ${role.name} ${granted ? 'granted to' : 'revoked from'} ${user.email}`,
    );
    return true;
  }

  async listProjects(
    search?: string,
    offset = 0,
    limit = PAGE_SIZE,
  ): Promise<AdminProjectPage> {
    const where = search?.trim()
      ? '(LOWER(project.projectName) LIKE :q OR LOWER(owner.email) LIKE :q)'
      : '1=1';
    const params = { q: `%${search?.trim().toLowerCase() ?? ''}%` };

    const [projects, total] = await this.projects
      .createQueryBuilder('project')
      .leftJoinAndSelect('project.user', 'owner')
      .where('project.isDeleted = :deleted', { deleted: false })
      .andWhere(where, params)
      .orderBy('project.createdAt', 'DESC')
      .skip(offset)
      .take(clampLimit(limit))
      .getManyAndCount();

    const base = getProjectsDir();
    const counts = await this.chatCounts(
      'projectId',
      projects.map((p) => p.id),
    );
    const items = await Promise.all(
      projects.map(async (project) => ({
        id: project.id,
        projectName: project.projectName,
        projectPath: project.projectPath,
        isPublic: project.isPublic,
        ownerEmail: project.user?.email ?? 'unknown',
        chats: counts.get(project.id) ?? 0,
        // In sandbox mode the files live in a remote microVM, not under
        // `base` — stat()ing the host path branded every healthy project
        // "no files". A workspace name is the honest signal there; probing
        // each sandbox would cost one API round trip per row.
        onDisk: project.projectPath
          ? sandboxMode() === 'host'
            ? await fs
                .stat(path.join(base, project.projectPath))
                .then(() => true)
                .catch(() => false)
            : true
          : false,
        createdAt: project.createdAt,
      })),
    );
    return { items, total };
  }

  /** Same path the product uses, so files and chats go with the row. */
  deleteProject(projectId: string): Promise<boolean> {
    return this.projectService.deleteProject(projectId);
  }

  /**
   * The owner-facing mutation checks ownership, so an operator moderating
   * someone else's gallery entry was told "no permission". This is the
   * role-gated path for that.
   */
  async setProjectPublic(
    projectId: string,
    isPublic: boolean,
  ): Promise<boolean> {
    const project = await this.projects.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('No such project');
    project.isPublic = isPublic;
    await this.projects.save(project);
    this.logger.log(
      `Project ${project.projectName} set ${isPublic ? 'public' : 'private'}`,
    );
    return true;
  }

  async setUserActive(
    actingUserId: string,
    userId: string,
    isActive: boolean,
  ): Promise<boolean> {
    // Same lockout as revoking your own Admin, by a different door: login
    // refuses an inactive account (auth.service), so disabling yourself ends
    // the session you are holding and no product path can undo it.
    if (!isActive && userId === actingUserId) {
      throw new BadRequestException(
        'You cannot disable your own account — ask another admin to do it',
      );
    }
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('No such user');
    user.isActive = isActive;
    await this.users.save(user);
    // Disabling only stopped the NEXT sign-in: the guard reads isActive per
    // request now, but the sessions already open kept working until their
    // tokens aged out. Suspending an account has to mean "signed out", or the
    // button is a suggestion.
    if (!isActive) {
      const ended = await this.authService.endAllSessions(userId);
      this.logger.log(`Ended ${ended} session(s) for ${user.email}`);
    }
    this.logger.log(
      `User ${user.email} set ${isActive ? 'active' : 'inactive'}`,
    );
    return true;
  }

  async stopPreview(projectPath: string): Promise<boolean> {
    await this.previews.stop(projectPath);
    return true;
  }

  /**
   * Remove directories with no live project row.
   *
   * A failed delete or a crashed scaffold leaves a full dependency tree — a
   * gigabyte each — that nothing will ever reclaim on its own.
   */
  async sweepOrphans(): Promise<number> {
    const base = getProjectsDir();
    const live = new Set(
      (
        await this.projects.find({
          where: { isDeleted: false },
          select: ['projectPath'],
        })
      ).map((p) => p.projectPath),
    );

    let removed = 0;
    for (const entry of await fs.readdir(base, { withFileTypes: true })) {
      if (!entry.isDirectory() || NOT_A_PROJECT.test(entry.name)) continue;
      if (live.has(entry.name)) continue;
      // It may still be serving; killing it first is what makes the removal
      // stick rather than getting rebuilt underneath us.
      await this.previews.stop(entry.name);
      await fs.rm(path.join(base, entry.name), {
        recursive: true,
        force: true,
      });
      removed += 1;
    }

    removed += await this.sweepAgentRuns(base);
    this.logger.log(`Swept ${removed} orphaned directories`);
    return removed;
  }

  /** Spent agent session state, older than a turn could possibly still need. */
  private async sweepAgentRuns(base: string): Promise<number> {
    const dir = path.join(base, AGENT_RUNS);
    let entries: Awaited<ReturnType<typeof fs.readdir>>;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      // No agent has run on this deployment yet.
      return 0;
    }

    const cutoff = Date.now() - AGENT_RUN_TTL_MS;
    let removed = 0;
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const full = path.join(dir, entry.name);
      try {
        // mtime, not birthtime: a resumed session writes to its log, and that
        // is exactly the session not to throw away.
        if ((await fs.stat(full)).mtimeMs > cutoff) continue;
        await fs.rm(full, { recursive: true, force: true });
        removed += 1;
      } catch (error) {
        // One unreadable directory must not abandon the rest of the sweep.
        this.logger.warn(`Could not sweep ${full}: ${error}`);
      }
    }
    return removed;
  }
}
