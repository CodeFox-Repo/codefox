import { Args, Mutation, Query, Resolver, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { User } from '../user/user.model';
import { Chat } from '../chat/chat.model';
import { Project } from '../project/project.model';
import { TelemetryLog } from '../interceptor/telemetry-log.model';
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
import { TelemetryLogFilterInput } from './dto/telemetry-log-input';
import { RequireRoles } from '../decorator/auth.decorator';
import { JWTAuthGuard } from '../guard/jwt-auth.guard';
import { CreateRoleInput } from 'src/auth/role/dto/create-role.input';
import { UpdateRoleInput } from 'src/auth/role/dto/update-role.input';
import { Role } from 'src/auth/role/role.model';
import { GetUserIdFromToken } from 'src/decorator/get-auth-token.decorator';
import { CreateProjectInput } from 'src/project/dto/project.input';
import { DashboardStats } from './dashboard-stat.model';
import { TelemetryLogService } from 'src/interceptor/telemetry-log.service';

@Resolver()
@UseGuards(JWTAuthGuard)
export class DashboardResolver {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly telemetryLogService: TelemetryLogService,
  ) {}

  @RequireRoles('Admin')
  @Query(() => [User])
  async dashboardUsers(
    @Args('filter', { nullable: true }) filter?: UserFilterInput,
  ): Promise<User[]> {
    return await this.dashboardService.findUsers(filter);
  }

  @RequireRoles('Admin')
  @Query(() => User)
  async dashboardUser(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<User> {
    return this.dashboardService.findUserById(id);
  }

  @RequireRoles('Admin')
  @Mutation(() => User)
  async createDashboardUser(
    @Args('input') input: CreateUserInput,
  ): Promise<User> {
    return this.dashboardService.createUser(input);
  }

  @RequireRoles('Admin')
  @Mutation(() => User)
  async updateDashboardUser(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateUserInput,
  ): Promise<User> {
    return this.dashboardService.updateUser(id, input);
  }

  @RequireRoles('Admin')
  @Mutation(() => Boolean)
  async deleteDashboardUser(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.dashboardService.deleteUser(id);
  }

  // Chat Management
  @RequireRoles('Admin')
  @Query(() => [Chat])
  async dashboardChats(
    @Args('filter', { nullable: true }) filter?: ChatFilterInput,
  ): Promise<Chat[]> {
    return this.dashboardService.findChats(filter);
  }

  @RequireRoles('Admin')
  @Query(() => Chat)
  async dashboardChat(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Chat> {
    return this.dashboardService.findChatById(id);
  }

  @RequireRoles('Admin')
  @Mutation(() => Chat)
  async createDashboardChat(
    @GetUserIdFromToken() userId: string,
    @Args('input') input: CreateChatInput,
  ): Promise<Chat> {
    return this.dashboardService.createChat(input, userId);
  }

  @RequireRoles('Admin')
  @Mutation(() => Chat)
  async updateDashboardChat(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateChatInput,
  ): Promise<Chat> {
    return this.dashboardService.updateChat(id, input);
  }

  @RequireRoles('Admin')
  @Mutation(() => Boolean)
  async deleteDashboardChat(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.dashboardService.deleteChat(id);
  }

  // Project Management
  @RequireRoles('Admin')
  @Query(() => [Project])
  async dashboardProjects(
    @Args('filter', { nullable: true }) filter?: ProjectFilterInput,
  ): Promise<Project[]> {
    return this.dashboardService.findProjects(filter);
  }

  @RequireRoles('Admin')
  @Query(() => Project)
  async dashboardProject(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Project> {
    return this.dashboardService.findProjectById(id);
  }

  @RequireRoles('Admin')
  @Mutation(() => Chat)
  async createDashboardProject(
    @GetUserIdFromToken() userId: string,
    @Args('input') input: CreateProjectInput,
  ): Promise<Chat> {
    return await this.dashboardService.createProject(input, userId);
  }

  @RequireRoles('Admin')
  @Mutation(() => Project)
  async updateDashboardProject(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateProjectInput,
  ): Promise<Project> {
    return this.dashboardService.updateProject(id, input);
  }

  @RequireRoles('Admin')
  @Mutation(() => Boolean)
  async deleteDashboardProject(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.dashboardService.deleteProject(id);
  }

  // Role Management
  @RequireRoles('Admin')
  @Query(() => [Role])
  async dashboardRoles(): Promise<Role[]> {
    return this.dashboardService.findRoles();
  }

  @RequireRoles('Admin')
  @Query(() => Role)
  async dashboardRole(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Role> {
    return this.dashboardService.findRoleById(id);
  }

  @RequireRoles('Admin')
  @Mutation(() => Role)
  async createDashboardRole(
    @Args('input') input: CreateRoleInput,
  ): Promise<Role> {
    return this.dashboardService.createRole(input);
  }

  @RequireRoles('Admin')
  @Mutation(() => Role)
  async updateDashboardRole(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateRoleInput,
  ): Promise<Role> {
    return this.dashboardService.updateRole(id, input);
  }

  @RequireRoles('Admin')
  @Mutation(() => Boolean)
  async deleteDashboardRole(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.dashboardService.deleteRole(id);
  }

  // Dashboard Stats
  @RequireRoles('Admin')
  @Query(() => DashboardStats)
  async dashboardStats(): Promise<DashboardStats> {
    return this.dashboardService.getDashboardStats();
  }

  // Telemetry Log Management
  @RequireRoles('Admin')
  @Query(() => [TelemetryLog])
  async dashboardTelemetryLogs(
    @Args('filter', { nullable: true }) filter?: TelemetryLogFilterInput,
  ): Promise<TelemetryLog[]> {
    return this.telemetryLogService.findFiltered(filter);
  }

  @RequireRoles('Admin')
  @Query(() => TelemetryLog)
  async dashboardTelemetryLog(
    @Args('id', { type: () => ID }) id: number,
  ): Promise<TelemetryLog> {
    return this.telemetryLogService.findById(id);
  }

  @RequireRoles('Admin')
  @Query(() => Number)
  async dashboardTelemetryLogsCount(
    @Args('filter', { nullable: true }) filter?: TelemetryLogFilterInput,
  ): Promise<number> {
    return this.telemetryLogService.countTelemetryLogs(filter);
  }
}
