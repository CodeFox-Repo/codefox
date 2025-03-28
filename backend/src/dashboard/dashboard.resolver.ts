import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { DashboardService } from './dashboard.service';
import { User } from '../user/user.model';
import {
  CreateUserInput,
  UpdateUserInput,
  UserFilterInput,
} from './dto/user-input';
import { RequireRoles } from '../decorator/auth.decorator';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '../guard/gql-auth.guard';

@Resolver(() => User)
@UseGuards(GqlAuthGuard)
export class DashboardResolver {
  constructor(private readonly dashboardService: DashboardService) {}

  @Query(() => [User])
  @RequireRoles('Admin')
  async dashboardUsers(
    @Args('filter', { nullable: true }) filter?: UserFilterInput,
  ): Promise<User[]> {
    return this.dashboardService.findUsers(filter);
  }

  @Query(() => User)
  @RequireRoles('Admin')
  async dashboardUser(@Args('id') id: string): Promise<User> {
    return this.dashboardService.findUserById(id);
  }

  @Mutation(() => User)
  @RequireRoles('Admin')
  async createDashboardUser(
    @Args('input') input: CreateUserInput,
  ): Promise<User> {
    return this.dashboardService.createUser(input);
  }

  @Mutation(() => User)
  @RequireRoles('Admin')
  async updateDashboardUser(
    @Args('id') id: string,
    @Args('input') input: UpdateUserInput,
  ): Promise<User> {
    return this.dashboardService.updateUser(id, input);
  }

  @Mutation(() => Boolean)
  @RequireRoles('Admin')
  async deleteDashboardUser(@Args('id') id: string): Promise<boolean> {
    return this.dashboardService.deleteUser(id);
  }
}
