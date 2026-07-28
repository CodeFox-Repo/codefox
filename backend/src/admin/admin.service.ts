import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Chat } from 'src/chat/chat.model';
import { User } from 'src/user/user.model';
import { getProjectsDir } from '../common/utils/common-path';
import { DEFAULT_MODEL } from '../common/constants/ai.constants';
import { Project } from '../project/project.model';
import { PreviewService } from '../project/preview.service';
import { ProjectService } from '../project/project.service';
import { AdminDisk, AdminOverview, AdminProject, AdminUser } from './admin.model';

/** Directories the agent and its bridge leave behind, which are not projects. */
const NOT_A_PROJECT = /^(\.|codex-)/;

@Injectable()
export class AdminService {
  private readonly logger = new Logger('AdminService');

  constructor(
    @InjectRepository(Project) private projects: Repository<Project>,
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(Chat) private chats: Repository<Chat>,
    private previews: PreviewService,
    private projectService: ProjectService,
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

  async listUsers(): Promise<AdminUser[]> {
    const users = await this.users.find({
      where: { isDeleted: false },
      relations: ['roles'],
      order: { createdAt: 'DESC' },
    });

    return Promise.all(
      users.map(async (user) => ({
        id: user.id,
        email: user.email,
        username: user.username,
        isActive: user.isActive,
        roles: (user.roles ?? []).map((role) => role.name),
        projects: await this.projects.count({
          where: { userId: user.id, isDeleted: false },
        }),
        // `Chat.userId` is a @RelationId, which is populated on read but is
        // not a column the query builder can filter on.
        chats: await this.chats.count({
          where: { user: { id: user.id }, isDeleted: false },
        }),
        createdAt: user.createdAt,
      })),
    );
  }

  async listProjects(): Promise<AdminProject[]> {
    const projects = await this.projects.find({
      where: { isDeleted: false },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });

    const base = getProjectsDir();
    return Promise.all(
      projects.map(async (project) => ({
        id: project.id,
        projectName: project.projectName,
        projectPath: project.projectPath,
        isPublic: project.isPublic,
        ownerEmail: project.user?.email ?? 'unknown',
        chats: await this.chats.count({
          where: { project: { id: project.id }, isDeleted: false },
        }),
        onDisk: project.projectPath
          ? await fs
              .stat(path.join(base, project.projectPath))
              .then(() => true)
              .catch(() => false)
          : false,
        createdAt: project.createdAt,
      })),
    );
  }

  /** Same path the product uses, so files and chats go with the row. */
  deleteProject(projectId: string): Promise<boolean> {
    return this.projectService.deleteProject(projectId);
  }

  async setUserActive(userId: string, isActive: boolean): Promise<boolean> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('No such user');
    user.isActive = isActive;
    await this.users.save(user);
    this.logger.log(`User ${user.email} set ${isActive ? 'active' : 'inactive'}`);
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
      await fs.rm(path.join(base, entry.name), { recursive: true, force: true });
      removed += 1;
    }
    this.logger.log(`Swept ${removed} orphaned project directories`);
    return removed;
  }
}
