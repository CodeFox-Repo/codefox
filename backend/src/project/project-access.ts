import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { Repository } from 'typeorm';
import { Project } from './project.model';

/**
 * Refuse a project that does not belong to the caller.
 *
 * The REST side of the product — file tree, file read/write, preview, cover
 * screenshot — had no authentication at all, so a project's directory name was
 * the only thing standing between a stranger and someone else's source, their
 * running preview, and write access to their working tree.
 *
 * `ProjectGuard` cannot do this job: it reads its argument out of a GraphQL
 * execution context, so on a REST route it finds no identifier and returns
 * true. This is deliberately a plain function rather than a second guard —
 * each route names its own parameter, and passing that name through guard
 * metadata is more machinery than three call sites are worth.
 *
 * Reads are allowed on a public project so the gallery can show one without
 * forking it first; anything that writes or spends resources is owner-only.
 */
export async function assertProjectAccess({
  projects,
  req,
  projectPath,
  write,
}: {
  projects: Repository<Project>;
  req: Request;
  projectPath: string | undefined;
  write: boolean;
}): Promise<Project> {
  // Set by JWTAuthGuard once it has verified the signature and checked that
  // the token has not been invalidated by a logout.
  const userId = (req as any).user?.userId;
  if (!userId) throw new ForbiddenException('Not signed in');

  // Callers pass either a bare directory name or a path inside the project.
  const dir = projectPath?.split('/')[0];
  if (!dir) throw new BadRequestException('Missing project');

  const project = await projects.findOne({
    where: { projectPath: dir, isDeleted: false },
  });
  if (!project) throw new NotFoundException('No such project');

  if (project.userId === userId) return project;
  if (!write && project.isPublic) return project;
  throw new ForbiddenException('This project is not yours');
}
