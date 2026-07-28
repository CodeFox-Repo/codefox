import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JWTAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminOverview, AdminProject, AdminUser } from './admin.model';
import { AdminService } from './admin.service';

/**
 * The operator console's API.
 *
 * Both guards, in this order: RolesGuard reads the user off the request, and
 * only JWTAuthGuard puts it there after verifying the signature. On its own it
 * would be asking an unauthenticated request what roles it claims to have.
 *
 * `Roles` rather than `RequireRoles`: the latter attaches RolesGuard by
 * itself, which puts it ahead of the guard that populates the user.
 */
@Resolver()
@UseGuards(JWTAuthGuard, RolesGuard)
@Roles('Admin')
export class AdminResolver {
  constructor(private readonly admin: AdminService) {}

  @Query(() => AdminOverview)
  adminOverview(): Promise<AdminOverview> {
    return this.admin.overview();
  }

  @Query(() => [AdminUser])
  adminUsers(): Promise<AdminUser[]> {
    return this.admin.listUsers();
  }

  @Query(() => [AdminProject])
  adminProjects(): Promise<AdminProject[]> {
    return this.admin.listProjects();
  }

  @Mutation(() => Boolean)
  adminDeleteProject(
    @Args('projectId') projectId: string,
  ): Promise<boolean> {
    return this.admin.deleteProject(projectId);
  }

  @Mutation(() => Boolean)
  adminSetProjectPublic(
    @Args('projectId') projectId: string,
    @Args('isPublic') isPublic: boolean,
  ): Promise<boolean> {
    return this.admin.setProjectPublic(projectId, isPublic);
  }

  @Mutation(() => Boolean)
  adminSetUserActive(
    @Args('userId') userId: string,
    @Args('isActive') isActive: boolean,
  ): Promise<boolean> {
    return this.admin.setUserActive(userId, isActive);
  }

  @Mutation(() => Boolean)
  adminStopPreview(
    @Args('projectPath') projectPath: string,
  ): Promise<boolean> {
    return this.admin.stopPreview(projectPath);
  }

  /** Returns how many directories were reclaimed. */
  @Mutation(() => Int)
  adminSweepOrphans(): Promise<number> {
    return this.admin.sweepOrphans();
  }
}
