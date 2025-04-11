// GraphQL Resolvers for Project APIs
import {
  Args,
  Mutation,
  Query,
  Resolver,
  ResolveField,
  Parent,
  ID,
  Int,
} from '@nestjs/graphql';
import { ProjectService } from './project.service';
import { Project } from './project.model';
import {
  CreateProjectInput,
  FetchPublicProjectsInputs,
  IsValidProjectInput,
  UpdateProjectPhotoInput,
} from './dto/project.input';
import { Logger, UseGuards } from '@nestjs/common';
import { ProjectGuard } from '../guard/project.guard';
import { GetUserIdFromToken } from '../decorator/get-auth-token.decorator';
import { Chat } from 'src/chat/chat.model';
import { User } from 'src/user/user.model';
import { validateAndBufferFile } from 'src/common/security/file_check';

@Resolver(() => Project)
export class ProjectsResolver {
  private readonly logger = new Logger('ProjectsResolver');
  constructor(private readonly projectService: ProjectService) {}

  @Query(() => [Project])
  async getUserProjects(
    @GetUserIdFromToken() userId: string,
  ): Promise<Project[]> {
    return this.projectService.getProjectsByUser(userId);
  }

  @Query(() => Project)
  @UseGuards(ProjectGuard)
  async getProject(@Args('projectId') projectId: string): Promise<Project> {
    return this.projectService.getProjectById(projectId);
  }

  @Mutation(() => Chat)
  async createProject(
    @GetUserIdFromToken() userId: string,
    @Args('createProjectInput') createProjectInput: CreateProjectInput,
  ): Promise<Chat> {
    const resChat = await this.projectService.createProject(
      createProjectInput,
      userId,
    );
    return resChat;
  }

  @Mutation(() => Boolean)
  @UseGuards(ProjectGuard)
  async deleteProject(@Args('projectId') projectId: string): Promise<boolean> {
    return this.projectService.deleteProject(projectId);
  }

  @Query(() => Boolean)
  async isValidateProject(
    @GetUserIdFromToken() userId: string,
    @Args('isValidProject') input: IsValidProjectInput,
  ): Promise<boolean> {
    return this.projectService.isValidProject(userId, input);
  }

  @ResolveField('user', () => User)
  async getUser(@Parent() project: Project): Promise<User> {
    const { user } = await this.projectService.getProjectById(project.id);
    return user;
  }

  @ResolveField('chats', () => [Chat])
  async getChats(@Parent() project: Project): Promise<Chat[]> {
    const { chats } = await this.projectService.getProjectById(project.id);
    return (await chats)?.filter((chat) => !chat.isDeleted) || [];
  }

  @Mutation(() => Project)
  async subscribeToProject(
    @GetUserIdFromToken() userId: string,
    @Args('projectId', { type: () => ID }) projectId: string,
  ): Promise<Project> {
    this.logger.log(`User ${userId} subscribing to project ${projectId}`);
    return this.projectService.subscribeToProject(userId, projectId);
  }

  @UseGuards(ProjectGuard)
  @Mutation(() => Project)
  async updateProjectPhoto(
    @GetUserIdFromToken() userId: string,
    @Args('input') input: UpdateProjectPhotoInput,
  ): Promise<Project> {
    const { projectId, file } = input;
    this.logger.log(`User ${userId} uploading photo for project ${projectId}`);

    // Extract the file data
    // Validate file and convert it to buffer
    const { buffer, mimetype } = await validateAndBufferFile(file);

    // Call the service with the extracted buffer and mimetype
    const project1= await this.projectService.updateProjectPhotoUrl(
      userId,
      projectId,
      buffer,
      mimetype,
    );
    this.logger.debug('project1', project1.photoUrl);
    return project1;
  }

  @Mutation(() => Project)
  async updateProjectPublicStatus(
    @GetUserIdFromToken() userId: string,
    @Args('projectId', { type: () => ID }) projectId: string,
    @Args('isPublic') isPublic: boolean,
  ): Promise<Project> {
    this.logger.log(
      `User ${userId} updating public status for project ${projectId} to ${isPublic}`,
    );
    return this.projectService.updateProjectPublicStatus(
      userId,
      projectId,
      isPublic,
    );
  }

  @Mutation(() => Chat)
  async forkProject(
    @GetUserIdFromToken() userId: string,
    @Args('projectId', { type: () => ID }) projectId: string,
  ): Promise<Chat> {
    this.logger.log(`User ${userId} forking project ${projectId}`);
    return this.projectService.forkProject(userId, projectId);
  }

  @Query(() => [Project])
  async getSubscribedProjects(
    @GetUserIdFromToken() userId: string,
  ): Promise<Project[]> {
    this.logger.log(`Fetching subscribed projects for user ${userId}`);
    return this.projectService.getSubscribedProjects(userId);
  }

  /**
   * Fetch public projects with limittation
   * TODO(Sma1lboy): handle Rate limit later - each MAC shouldn't exceed 20 requests per minute
   * @param input the inputs
   * @returns return some projects
   */
  @Query(() => [Project])
  async fetchPublicProjects(
    @GetUserIdFromToken() userId: string,
    @Args('input') input: FetchPublicProjectsInputs,
  ): Promise<Project[]> {
    input.currentUserId = userId;
    return this.projectService.fetchPublicProjects(input);
  }

  // In ProjectsResolver:
  @Query(() => Int)
  async getRemainingProjectLimit(
    @GetUserIdFromToken() userId: string,
  ): Promise<number> {
    return this.projectService.getRemainingProjectLimit(userId);
  }

  @Mutation(() => Project)
  async syncProjectToGitHub(
    @Args('projectId') projectId: string,
    @GetUserIdFromToken() userId: string,
  ) {
    // TODO: MAKE PUBLIC DYNAMIC
    return this.projectService.syncProjectToGitHub(
      userId,
      projectId,
      true /* isPublic? */,
    );
  }
}
