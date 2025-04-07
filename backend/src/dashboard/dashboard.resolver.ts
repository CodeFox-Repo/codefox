import { Args, Mutation, Query, Resolver, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { User } from '../user/user.model';
import { Chat } from '../chat/chat.model';
import { Project } from '../project/project.model';
import {
  CreateUserInput,
  UpdateUserInput,
  UserFilterInput,
} from './dto/user-input';
import {
  ChatFilterInput,
  CreateChatInput,
  UpdateChatInput,
} from './dto/chat-input';
import { ProjectFilterInput, UpdateProjectInput } from './dto/project-input';
import { RequireRoles } from '../decorator/auth.decorator';
import { JWTAuthGuard } from '../guard/jwt-auth.guard';
import { AuthService } from 'src/auth/auth.service';
import { CreateRoleInput } from 'src/auth/role/dto/create-role.input';
import { UpdateRoleInput } from 'src/auth/role/dto/update-role.input';
import { Role } from 'src/auth/role/role.model';
import { GetUserIdFromToken } from 'src/decorator/get-auth-token.decorator';
import { CreateProjectInput } from 'src/project/dto/project.input';

@Resolver()
@UseGuards(JWTAuthGuard)
export class DashboardResolver {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly authService: AuthService,
  ) {}

  @Query(() => [User])
  async dashboardUsers(
    @Args('filter', { nullable: true }) filter?: UserFilterInput,
  ): Promise<User[]> {
    return await this.dashboardService.findUsers(filter);
  }

  @Query(() => User)
  async dashboardUser(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<User> {
    return this.dashboardService.findUserById(id);
  }

  @Mutation(() => User)
  async createDashboardUser(
    @Args('input') input: CreateUserInput,
  ): Promise<User> {
    return this.dashboardService.createUser(input);
  }

  @Mutation(() => User)
  async updateDashboardUser(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateUserInput,
  ): Promise<User> {
    return this.dashboardService.updateUser(id, input);
  }

  @Mutation(() => Boolean)
  async deleteDashboardUser(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.dashboardService.deleteUser(id);
  }

  // Chat Management
  @Query(() => [Chat])
  async dashboardChats(
    @Args('filter', { nullable: true }) filter?: ChatFilterInput,
  ): Promise<Chat[]> {
    return this.dashboardService.findChats(filter);
  }

  @Query(() => Chat)
  async dashboardChat(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Chat> {
    return this.dashboardService.findChatById(id);
  }

  @Mutation(() => Chat)
  async createDashboardChat(
    @Args('input') input: CreateChatInput,
  ): Promise<Chat> {
    return this.dashboardService.createChat(input);
  }

  @Mutation(() => Chat)
  async updateDashboardChat(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateChatInput,
  ): Promise<Chat> {
    return this.dashboardService.updateChat(id, input);
  }

  @Mutation(() => Boolean)
  async deleteDashboardChat(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.dashboardService.deleteChat(id);
  }

  // Project Management
  @Query(() => [Project])
  async dashboardProjects(
    @Args('filter', { nullable: true }) filter?: ProjectFilterInput,
  ): Promise<Project[]> {
    return this.dashboardService.findProjects(filter);
  }

  @Query(() => Project)
  async dashboardProject(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Project> {
    return this.dashboardService.findProjectById(id);
  }

  @Mutation(() => Project)
  async createDashboardProject(
    @GetUserIdFromToken() userId: string,
    @Args('input') input: CreateProjectInput,
  ): Promise<Chat> {
    return await this.dashboardService.createProject(input, userId);
  }

  @Mutation(() => Project)
  async updateDashboardProject(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateProjectInput,
  ): Promise<Project> {
    return this.dashboardService.updateProject(id, input);
  }

  @Mutation(() => Boolean)
  async deleteDashboardProject(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.dashboardService.deleteProject(id);
  }

  @Query(() => [Role])
  async dashboardRoles(): Promise<Role[]> {
    return this.dashboardService.findRoles();
  }

  @Query(() => Role)
  async dashboardRole(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Role> {
    return this.dashboardService.findRoleById(id);
  }

  @Mutation(() => Role)
  async createDashboardRole(
    @Args('input') input: CreateRoleInput,
  ): Promise<Role> {
    return this.dashboardService.createRole(input);
  }

  @Mutation(() => Role)
  async updateDashboardRole(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateRoleInput,
  ): Promise<Role> {
    return this.dashboardService.updateRole(id, input);
  }

  @Mutation(() => Boolean)
  async deleteDashboardRole(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.dashboardService.deleteRole(id);
  }
}
