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
import { validateAndBufferFile } from 'src/common/security/file_check';
import {
  DesignSystemChoice,
  designSystemChoices,
  RestyleResult,
} from './design-systems';
import { ScenarioChoice, scenarioChoices } from './scenarios';
import { DeployResult } from './deploy';
import { Byline } from './byline.model';

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

  /**
   * Who published a project — the byline on a gallery card, and nothing more.
   *
   * Reachable anonymously: `fetchPublicProjects` is @Public and this is a
   * field on what it returns. Field resolvers run with no guard at all
   * (APP_GUARD does not reach them without `fieldResolverEnhancers`, which is
   * unset), so everything the return TYPE advertises is public by
   * construction — see Byline for why narrowing this projection was not on
   * its own enough.
   */
  @ResolveField('user', () => Byline)
  async getUser(@Parent() project: Project): Promise<Byline> {
    // `fetchPublicProjects` already loads `user` (relations: ['user']), so the
    // byline is on the parent. Refetching per card cost two more queries each
    // — one of them joining `chat`, pulling every conversation of every
    // project on the wall to read three columns. Six cards were 14 queries.
    //
    // Falls back to a load for any caller that arrives without the relation;
    // the projection is unchanged either way, which is what keeps this a
    // byline and not a User.
    const user =
      project.user ?? (await this.projectService.getProjectById(project.id)).user;
    return {
      id: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
    };
  }

  // No `chats` field resolver: `Project.chats` is no longer in the schema. It
  // was the conversation that built the project, hanging off the @Public
  // gallery query with no guard — see the comment on Project.chats. Nothing
  // ever selected it; guarded `getChatDetails` is how a client reads a chat.

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

  /** Copy your own project, to try a big change without risking the original. */
  @Mutation(() => Chat)
  @JWTAuth()
  async duplicateProject(
    @GetUserIdFromToken() userId: string,
    @Args('projectId', { type: () => ID }) projectId: string,
  ): Promise<Chat> {
    this.logger.log(`User ${userId} duplicating project ${projectId}`);
    return this.projectService.duplicateProject(userId, projectId);
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

  /** What you can make. Public for the same reason: the composer is on the
   *  landing page, before anyone signs in. */
  @Query(() => [ScenarioChoice])
  @Public()
  scenarios(): ScenarioChoice[] {
    return scenarioChoices();
  }

  /**
   * Swap a page's design system after the fact. Snapshotted, so the previous
   * look stays in History — the picker is not a one-way door.
   */
  /**
   * Publish a page to the user's own host. The token is a pass-through
   * credential — it is never written to the database or the logs.
   */
  @Mutation(() => DeployResult)
  @JWTAuth()
  async deployProject(
    @GetUserIdFromToken() userId: string,
    @Args('projectId', { type: () => ID }) projectId: string,
    @Args('provider') provider: string,
    @Args('token') token: string,
  ): Promise<DeployResult> {
    this.logger.log(`User ${userId} deploying ${projectId} to ${provider}`);
    return this.projectService.deployProject(userId, projectId, provider, token);
  }

  @Mutation(() => RestyleResult)
  @JWTAuth()
  async restyleProject(
    @GetUserIdFromToken() userId: string,
    @Args('projectId', { type: () => ID }) projectId: string,
    @Args('styleId') styleId: string,
  ): Promise<RestyleResult> {
    this.logger.log(`User ${userId} restyling ${projectId} to ${styleId}`);
    return this.projectService.restyleProject(userId, projectId, styleId);
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
