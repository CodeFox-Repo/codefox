// GraphQL Resolvers for Project APIs
import { Public } from 'src/common/decorators/public.decorator';
import {
  Args,
  Mutation,
  Query,
  Resolver,
  ResolveField,
  Parent,
  ID,
} from '@nestjs/graphql';
import { ProjectService } from './project.service';
import { Project } from './project.model';
import {
  CreateProjectInput,
  FetchPublicProjectsInputs,
  UpdateProjectPhotoInput,
} from './dto/project.input';
import { Logger, UseGuards } from '@nestjs/common';
import { ProjectGuard } from '../common/guards/project.guard';
import { JWTAuth } from 'src/common/decorators/jwt-auth.decorator';
import { GetUserIdFromToken } from '../common/decorators/get-auth-token.decorator';
import { Chat } from 'src/chat/chat.model';
import { User } from 'src/user/user.model';
import { validateAndBufferFile } from 'src/common/security/file_check';
import {
  DesignSystemChoice,
  designSystemChoices,
} from './design-systems';

@Resolver(() => Project)
export class ProjectsResolver {
  private readonly logger = new Logger('ProjectsResolver');
  constructor(private readonly projectService: ProjectService) {}

  @Query(() => [Project])
  @JWTAuth()
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
  @JWTAuth()
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
    return this.projectService.updateProjectPhotoUrl(
      userId,
      projectId,
      buffer,
      mimetype,
    );
  }

  @Mutation(() => Project)
  @JWTAuth()
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
  @JWTAuth()
  async forkProject(
    @GetUserIdFromToken() userId: string,
    @Args('projectId', { type: () => ID }) projectId: string,
  ): Promise<Chat> {
    this.logger.log(`User ${userId} forking project ${projectId}`);
    return this.projectService.forkProject(userId, projectId);
  }

  /**
   * Fetch public projects
   * @param input the inputs
   * @returns return some projects
   */
  @Query(() => [Project])
  @Public()
  async fetchPublicProjects(
    @Args('input') input: FetchPublicProjectsInputs,
  ): Promise<Project[]> {
    return this.projectService.fetchPublicProjects(input);
  }

  /** The style choices for a new page project. Public: the composer on the
   *  landing page renders before anyone signs in. */
  @Query(() => [DesignSystemChoice])
  @Public()
  designSystems(): DesignSystemChoice[] {
    return designSystemChoices();
  }

  // @Mutation(() => Project)
  // async syncProjectToGitHub(
  //   @Args('projectId') projectId: string,
  //   @GetUserIdFromToken() userId: string,
  // ) {
  //   // TODO: MAKE PUBLIC DYNAMIC
  //   return this.projectService.syncProjectToGitHub(
  //     userId,
  //     projectId,
  //     true /* isPublic? */,
  //   );
  // }
}
