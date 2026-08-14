import { ForbiddenException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Project } from './project.model';
import { DefaultRoles } from '../common/enums/role.enum';

/**
 * How many projects one account may hold.
 *
 * Nothing capped this: create and fork both ran unbounded, so one account
 * could fill the disk (each project is a directory, a Next one is ~1GB of
 * node_modules) and inflate every gallery query. Registration is closed
 * today, which is the only reason this has not bitten.
 *
 * Production is 170 projects across 127 users, so 20 is far above any real
 * user and still bounds the damage from one abusive account.
 */
export const DEFAULT_MAX_PROJECTS = 20;

export const maxProjectsPerUser = (): number => {
  const raw = Number(process.env.MAX_PROJECTS_PER_USER);
  // A malformed or absent value must not mean "no limit".
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_MAX_PROJECTS;
};

/**
 * Refuse a new project when the caller is already at their limit.
 *
 * One function, called by both create and fork — a second copy is how the
 * two drift apart and fork quietly becomes the way around the cap.
 *
 * Counts only live projects, so deleting one frees a slot immediately. An
 * existing user over the limit keeps everything they have; this only blocks
 * the next one.
 *
 * ponytail: a COUNT per creation, no cached counter to drift. Creation is
 * rare and already does far more work than one indexed count.
 */
export async function assertCanCreateProject(
  projects: Repository<Project>,
  userId: string,
  roles?: { name: string }[],
): Promise<void> {
  // Operators run the deployment and clean up after everyone else; capping
  // them is how you lock out the person who has to fix it.
  if (roles?.some((role) => role.name === DefaultRoles.ADMIN)) return;

  const limit = maxProjectsPerUser();
  const used = await projects.count({ where: { userId, isDeleted: false } });
  if (used < limit) return;

  throw new ForbiddenException(
    `You have ${used} projects, which is the limit of ${limit}. ` +
      `Delete one you no longer need to make room.`,
  );
}
