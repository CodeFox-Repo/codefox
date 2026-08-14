import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GetUserIdFromToken } from '../common/decorators/get-auth-token.decorator';
import { JWTAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import {
  AdminOverview,
  AdminProjectPage,
  AdminUserPage,
} from './admin.model';
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

  @Query(() => AdminUserPage)
  adminUsers(
    @Args('search', { nullable: true }) search?: string,
    @Args('offset', { type: () => Int, nullable: true }) offset?: number,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
  ): Promise<AdminUserPage> {
    return this.admin.listUsers(search, offset ?? 0, limit);
  }

  @Query(() => AdminProjectPage)
  adminProjects(
    @Args('search', { nullable: true }) search?: string,
    @Args('offset', { type: () => Int, nullable: true }) offset?: number,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
  ): Promise<AdminProjectPage> {
    return this.admin.listProjects(search, offset ?? 0, limit);
  }

  /** The grantable role names, so the console does not hardcode them. */
  @Query(() => [String])
  adminRoles(): Promise<string[]> {
    return this.admin.listRoles();
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
    @GetUserIdFromToken() actingUserId: string,
    @Args('userId') userId: string,
    @Args('isActive') isActive: boolean,
  ): Promise<boolean> {
    return this.admin.setUserActive(actingUserId, userId, isActive);
  }

  /**
   * Grant or revoke a role.
   *
   * The acting user comes from `GetUserIdFromToken`, which verifies the
   * signature — never from an argument. A client-supplied "who am I" is how
   * the self-lockout guard in the service would be trivially stepped around:
   * name someone else as the actor and revoke your own Admin anyway.
   */
  @Mutation(() => Boolean)
  adminSetUserRole(
    @GetUserIdFromToken() actingUserId: string,
    @Args('userId') userId: string,
    @Args('role') role: string,
    @Args('granted') granted: boolean,
  ): Promise<boolean> {
    return this.admin.setUserRole(actingUserId, userId, role, granted);
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
