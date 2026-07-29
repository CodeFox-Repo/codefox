// Project Service for managing Projects
import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { Project } from './project.model';
import {
  CreateProjectInput,
  FetchPublicProjectsInputs,
} from './dto/project.input';
import { generateText } from 'ai';
import { copyProject, scaffoldHtmlProject, scaffoldProject } from './scaffold';
import { staleMediaPath } from './media-file';
import { openrouter, DEFAULT_MODEL } from 'src/common/constants/ai.constants';
import { ChatService } from 'src/chat/chat.service';
import { Chat } from 'src/chat/chat.model';
import { v4 as uuidv4 } from 'uuid';
import { UploadService } from 'src/upload/upload.service';
import * as fs from 'fs';
import * as path from 'path';
import archiver from 'archiver';
import {
  getMediaDir,
  getProjectPath,
  getProjectsDir,
  getTempDir,
} from '../common/utils/common-path';
// import { GitHubService } from 'src/github/github.service';
import { UserService } from 'src/user/user.service';
import { PreviewService } from './preview.service';
import { WorkspaceService } from './workspace.service';
import {
  SANDBOX_ROOT,
  sandboxHandle,
  sandboxMode,
} from 'src/chat/sandbox-provider';

@Injectable()
export class ProjectService {
  private readonly logger = new Logger('ProjectService');

  constructor(
    @InjectRepository(Project)
    private projectsRepository: Repository<Project>,
    @InjectRepository(Chat)
    private chatRepository: Repository<Chat>,
    private chatService: ChatService,
    private uploadService: UploadService,
    // private readonly gitHubService: GitHubService,
    private userService: UserService,
    private previews: PreviewService,
    private workspaces: WorkspaceService,
  ) {}

  async getProjectsByUser(userId: string): Promise<Project[]> {
    const projects = await this.projectsRepository.find({
      where: { userId, isDeleted: false },
      relations: ['chats'],
    });

    if (projects && projects.length > 0) {
      await Promise.all(
        projects.map(async (project) => {
          // Filter deleted chats
          if (project.chats) {
            const chats = await project.chats;
            this.logger.log('Project chats:', chats);
            // Create a new Promise that resolves to filtered chats
            project.chats = Promise.resolve(
              chats.filter((chat) => !chat.isDeleted),
            );
          }
        }),
      );
    }

    return projects.length > 0 ? projects : [];
  }

  async getProjectById(projectId: string): Promise<Project> {
    const project = await this.projectsRepository.findOne({
      where: { id: projectId, isDeleted: false },
      relations: ['chats', 'user'],
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found.`);
    }

    if (project.chats) {
      const chats = await project.chats;
      this.logger.log('Project chats:', chats);
      project.chats = Promise.resolve(chats.filter((chat) => !chat.isDeleted));
    }

    return project;
  }

  // binding project and chats
  async bindProjectAndChat(project: Project, chat: Chat): Promise<boolean> {
    // No connection.synchronize() here: schema sync belongs to boot
    // (database.config.ts). Re-running it per project creation re-built
    // tables on SQLite and would alter a production schema mid-request.
    if (!chat) {
      this.logger.error('chat is undefined');
      return false;
    }
    try {
      chat.project = project;

      // Get current chats and add new chat
      const currentChats = await project.chats;
      project.chats = Promise.resolve([...currentChats, chat]);

      // Save both entities
      await this.projectsRepository.save(project);
      await this.chatRepository.save(chat);

      return true;
    } catch (error) {
      this.logger.error('Error binding project and chat:', error);
      return false;
    }
  }

  async createProject(
    input: CreateProjectInput,
    userId: string,
  ): Promise<Chat> {
    try {
      // handle project name generation if needed (this is the only sync operation we need)
      let projectName = input.projectName;
      if (!projectName || projectName === '') {
        this.logger.debug(
          'Project name not provided in input, generating project name',
        );

        const result = await generateText({
          model: openrouter(input.model || DEFAULT_MODEL),
          // A title is a handful of tokens. Left unset the SDK asks for the
          // model's full output window — 64k for Sonnet — which providers
          // reserve credit against and reject outright on a small balance.
          maxOutputTokens: 64,
          // ai@7 rejects role:'system' inside `messages`; instructions is the
          // replacement, and the old shape threw before reaching the model.
          instructions:
            'You are a specialized project name generator. Create a concise, descriptive project title (max 20 words) based on the description. Respond ONLY with the project name, no explanation.',
          prompt: `Generate a project name for: ${input.description}`,
        });

        projectName = result.text.trim();
        this.logger.debug(`Generated project name: ${projectName}`);
      }

      // Create chat with proper title
      const defaultChat = await this.chatService.createChatWithMessage(userId, {
        title: projectName || 'New Project Chat',
        message: input.description,
        model: input.model,
      });

      // Perform the rest of project creation asynchronously
      this.createProjectInBackground(input, projectName, userId, defaultChat);

      // Return chat immediately so user can start interacting
      return defaultChat;
    } catch (error) {
      this.logger.error(
        `Error in createProject: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Error creating the project.');
    }
  }

  // Background task for project creation: persist the row, then materialise a
  // working directory from the starter template. The agent edits that
  // directory; the frontend's file APIs read it.
  private async createProjectInBackground(
    input: CreateProjectInput,
    projectName: string,
    userId: string,
    chat: Chat,
  ): Promise<void> {
    try {
      // Create project entity and set properties
      const project = new Project();
      project.projectName = projectName;
      project.projectPath = '';
      project.userId = userId;
      project.isPublic = input.public || false;
      project.uniqueProjectId = uuidv4();
      // Light by default: most generated sites are a page, not a toolchain.
      project.template = input.template === 'next' ? 'next' : 'html';

      // Save project — the generated id names the project directory.
      const savedProject = await this.projectsRepository.save(project);
      this.logger.debug(`Project created: ${savedProject.id}`);

      try {
        // html projects scaffold on the host in both modes — a page needs no
        // microVM until the agent runs. The Next starter keeps its old paths:
        // host copy locally, template clone inside the sandbox.
        if (savedProject.template === 'html') {
          savedProject.projectPath = await scaffoldHtmlProject(
            savedProject.id,
            input.style,
          );
        } else {
          savedProject.projectPath =
            sandboxMode() === 'host'
              ? await scaffoldProject(savedProject.id)
              : savedProject.id;
        }
        await this.projectsRepository.save(savedProject);
      } catch (error) {
        // A failed scaffold leaves projectPath empty; the chat still works,
        // the agent just has no files. Loud, but not fatal to the request.
        this.logger.error(
          `Failed to scaffold project ${savedProject.id}: ${error.message}`,
          error.stack,
        );
      }

      // Bind chat to project
      const bindSuccess = await this.bindProjectAndChat(savedProject, chat);
      if (!bindSuccess) {
        this.logger.error(
          `Failed to bind project and chat: ${savedProject.id} -> ${chat.id}`,
        );
      } else {
        this.logger.debug(
          `Project and chat bound: ${savedProject.id} -> ${chat.id}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error in background project creation: ${error.message}`,
        error.stack,
      );
      // No exception is thrown since this is a background task
    }
  }

  async deleteProject(projectId: string): Promise<boolean> {
    const project = await this.projectsRepository.findOne({
      where: { id: projectId },
      relations: ['chats'],
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found.`);
    }

    try {
      // Soft delete the project
      project.isActive = false;
      project.isDeleted = true;
      await this.projectsRepository.save(project);

      // The row is only marked, but the files are gigabytes and nothing else
      // will ever come back for them — a scaffolded project is ~1GB with its
      // dependency tree, so leaving them turns every delete into a permanent
      // leak on the volume. Best effort: a failure here must not fail the
      // delete the user asked for.
      if (project.projectPath) {
        // Whatever is holding the project — a directory on this disk or a
        // microVM — is asked to throw itself away. A failure here must not
        // fail the delete the user asked for.
        const workspace = await this.workspaces.for(project.projectPath);
        await workspace
          .remove()
          .catch((error) =>
            this.logger.warn(
              `Could not remove ${project.projectPath}: ${error}`,
            ),
          );
      }

      // The cover outlived its project: deleting reclaimed the files and the
      // chats but never the screenshot, so every delete left a PNG on the
      // volume with nothing left pointing at it. Same rule as replacing one —
      // a fork inherits photoUrl, so never unlink a file another row still
      // uses. The row above is already marked deleted, so it excludes itself.
      if (project.photoUrl) {
        // This project is already marked deleted, so the count is of *other*
        // rows; staleMediaPath counts the caller too, hence the +1.
        const others = await this.projectsRepository.count({
          where: { photoUrl: project.photoUrl, isDeleted: false },
        });
        const stale = staleMediaPath(project.photoUrl, others + 1);
        if (stale) await fs.promises.unlink(stale).catch(() => undefined);
      }

      // Going through the relation returns nothing here — it is lazy, and the
      // save above has already left it unpopulated — so ask for the rows by
      // their foreign key instead.
      await this.chatRepository
        .createQueryBuilder()
        .update(Chat)
        .set({ isActive: false, isDeleted: true })
        .where('projectId = :projectId', { projectId })
        .execute();

      return true;
    } catch {
      throw new InternalServerErrorException('Error deleting the project.');
    }
  }

  /**
   * Update a project's photo URL
   * @param userId The user ID making the request
   * @param projectId The project ID to update
   * @param file The uploaded file buffer
   * @param mimeType The MIME type of the file
   * @returns The updated project
   */
  async updateProjectPhotoUrl(
    userId: string,
    projectId: string,
    file: Buffer,
    mimeType: string,
  ): Promise<Project> {
    const project = await this.getProjectById(projectId);

    // Check ownership permission
    this.checkProjectOwnership(project, userId);

    try {
      // Use the upload service to handle the file upload
      const subdirectory = `projects/${projectId}/images`;
      const uploadResult = await this.uploadService.upload(
        file,
        mimeType,
        subdirectory,
      );

      // Drop the cover this one replaces. Previews re-shoot on every open, so
      // without this every visit leaks another PNG into the media directory.
      //
      // A fork inherits the source's photoUrl, so the same file can back two
      // projects. Deleting it on the first re-shoot broke the other one's
      // cover — the gallery card 404s and the project drops off the wall,
      // which requires a cover. Only unlink a file nothing else points at.
      const previous = project.photoUrl;
      if (previous && previous !== uploadResult.url) {
        // The row is not saved yet, so this project is still counted: one
        // means nobody else points at the file.
        const users = await this.projectsRepository.count({
          where: { photoUrl: previous, isDeleted: false },
        });
        const stale = staleMediaPath(previous, users);
        if (stale) {
          await fs.promises.unlink(stale).catch(() => undefined);
        }
      }

      // Update the project with the new URL
      project.photoUrl = uploadResult.url;

      this.logger.debug(
        `Updated photo URL for project ${projectId} to ${uploadResult.url}`,
      );

      return this.projectsRepository.save(project);
    } catch (error) {
      this.logger.error('Error uploading image:', error);
      throw new InternalServerErrorException('Failed to upload image:', error);
    }
  }

  /**
   * Update a project's public status
   * @param userId The user ID making the request
   * @param projectId The project ID to update
   * @param isPublic The new public status
   * @returns The updated project
   */
  async updateProjectPublicStatus(
    userId: string,
    projectId: string,
    isPublic: boolean,
  ): Promise<Project> {
    const project = await this.getProjectById(projectId);

    // Check ownership permission
    this.checkProjectOwnership(project, userId);

    // Update public status
    project.isPublic = isPublic;

    return this.projectsRepository.save(project);
  }

  /**
   * Fork an existing project to create a copy for the current user
   * @param userId The user ID making the request
   * @param projectId The project ID to fork
   * @returns The chat associated with the newly created project
   */
  /**
   * Sandbox-to-sandbox copy for forks: zip the source workspace (the same
   * machinery the download button uses), then unpack it into the fork's own
   * fresh sandbox. The template files the new sandbox cloned are simply
   * overwritten — both sides come from the same starter.
   */
  private async copySandboxProject(
    sourcePath: string,
    newProjectId: string,
  ): Promise<string> {
    const source = await this.workspaces.for(sourcePath);
    const { zipPath } = await source.archive(`fork-${newProjectId}`);

    try {
      const sandbox = await sandboxHandle(newProjectId);
      const remoteZip = '/tmp/codefox-fork.zip';
      await sandbox.writeFiles([
        { path: remoteZip, content: new Uint8Array(fs.readFileSync(zipPath)) },
      ]);
      const unpack = await sandbox.runCommand({
        cmd: 'python3',
        args: ['-m', 'zipfile', '-e', remoteZip, SANDBOX_ROOT],
        timeoutMs: 5 * 60 * 1000,
      });
      if (unpack.exitCode !== 0) {
        throw new Error(
          `Unpacking the fork failed: ${(await unpack.stderr()).slice(-300)}`,
        );
      }
      return newProjectId;
    } finally {
      fs.promises
        .unlink(zipPath)
        .catch((error) =>
          this.logger.warn(`Could not remove ${zipPath}: ${error}`),
        );
    }
  }

  async forkProject(userId: string, projectId: string): Promise<Chat> {
    try {
      this.logger.debug(`User ${userId} forking project ${projectId}`);

      // Get the source project
      const sourceProject = await this.getProjectById(projectId);

      // Check if the project is public or owned by the requesting user
      if (!sourceProject.isPublic && sourceProject.userId !== userId) {
        throw new ForbiddenException(
          'Cannot fork a private project you do not own',
        );
      }

      // Prevent users from forking their own projects
      if (sourceProject.userId === userId) {
        throw new ForbiddenException('Cannot fork your own project');
      }

      // Create default chat for the new project
      const defaultChat = await this.chatService.createChat(userId, {
        title: `Fork of ${sourceProject.projectName}`,
      });

      // Create a new project entity
      const newProject = new Project();
      newProject.projectName = `Fork of ${sourceProject.projectName}`;
      newProject.projectPath = ''; // set below, once the id exists
      newProject.userId = userId;
      newProject.isPublic = false; // Default to private
      newProject.uniqueProjectId = uuidv4(); // Generate new unique ID
      newProject.forkedFromId = sourceProject.uniqueProjectId; // Reference the original
      newProject.photoUrl = sourceProject.photoUrl; // Copy screenshot if available
      newProject.template = sourceProject.template; // A fork is the same kind

      // Save the new project
      const savedProject = await this.projectsRepository.save(newProject);

      // Give the fork its own copy of the files. Sharing the source path let
      // one owner's edits land in the other's project.
      try {
        // The host copy reads this machine's disk — in sandbox mode the
        // source lives in a microVM, the host directory is empty, and the
        // "no files" fallback silently handed every fork a fresh template
        // instead of the project being forked.
        //
        // html is the exception in *both* modes, exactly as WorkspaceService
        // decides it: those files never leave the host. Branching on the mode
        // alone unpacked an html fork into a microVM that nothing would ever
        // read — the fork's own workspace is a host directory that was never
        // created, so it opened with no files at all.
        savedProject.projectPath =
          sandboxMode() === 'host' || savedProject.template === 'html'
            ? await copyProject(
                sourceProject.projectPath,
                savedProject.id,
                savedProject.template,
              )
            : await this.copySandboxProject(
                sourceProject.projectPath,
                savedProject.id,
              );
        await this.projectsRepository.save(savedProject);
      } catch (error) {
        this.logger.error(
          `Failed to copy files for fork ${savedProject.id}: ${error.message}`,
        );
      }

      // Atomic, in the database. Read-modify-write on the in-memory row lost
      // forks whenever two people forked at once: each read the same value
      // and each wrote value+1, so four simultaneous forks counted as one.
      // The gallery's trending strategy ranks by this field, so an
      // undercounted project is one the wall never surfaces.
      await this.projectsRepository.increment(
        { id: sourceProject.id },
        'subNumber',
        1,
      );

      // Bind chat to the new project
      await this.bindProjectAndChat(savedProject, defaultChat);

      return defaultChat;
    } catch (error) {
      this.logger.error(`Error forking project: ${error.message}`, error.stack);
      throw error instanceof ForbiddenException
        ? error
        : new InternalServerErrorException('Error forking the project.');
    }
  }

  /**
   * Check if a user owns a project
   * @param project The project to check
   * @param userId The user ID to verify
   * @throws ForbiddenException if user is not the owner
   */
  private checkProjectOwnership(project: Project, userId: string): void {
    if (project.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to modify this project',
      );
    }
  }

  async fetchPublicProjects(
    input: FetchPublicProjectsInputs,
  ): Promise<Project[]> {
    const limit = input.size > 50 ? 50 : input.size;

    // A cover is the entry fee. This filter was dropped once, correctly, when
    // capture was broken in three places and requiring a cover emptied the
    // gallery — but a wall of "no preview yet" tiles sells nothing either.
    // Capture works now (html projects shoot their file, app projects their
    // dev server), so a project with no cover is one nobody has opened yet,
    // and it can wait for its first visit before being showcased.
    const whereCondition = {
      isPublic: true,
      isDeleted: false,
      photoUrl: Not(IsNull()),
    };

    if (input.strategy === 'latest') {
      return this.projectsRepository.find({
        where: whereCondition,
        order: { createdAt: 'DESC' },
        take: limit,
        relations: ['user'],
      });
    } else if (input.strategy === 'trending') {
      // Was `ceil(total * 0.01)` capped against the caller's size, which
      // meant asking for six of 48 public projects returned exactly one —
      // trending only stopped being degenerate past 600 projects, so it read
      // as broken at every size the product has ever had. Rank by forks, then
      // recency; the caller's size is the only limit.
      return this.projectsRepository.find({
        where: whereCondition,
        order: { subNumber: 'DESC', createdAt: 'DESC' },
        take: limit,
        relations: ['user'],
      });
    }

    return [];
  }

  /**
   * Creates a ZIP file from a project's directory
   * @param userId The user ID making the request
   * @param projectId The project ID to download
   * @returns The path to the created ZIP file and the suggested filename
   */
  async createProjectZip(
    userId: string,
    projectId: string,
  ): Promise<{ zipPath: string; fileName: string }> {
    const project = await this.getProjectById(projectId);

    if (project.userId !== userId && !project.isPublic) {
      throw new ForbiddenException(
        'You do not have permission to download this project',
      );
    }

    const workspace = await this.workspaces.for(project.projectPath);
    return workspace.archive(project.projectName);
  }

  // /**
  //  * Sync a project to GitHub:
  //  * 1) Create a GitHub repo if needed.
  //  * 2) Recursively push the entire local project folder to the new repo.
  //  */
  // async syncProjectToGitHub(
  //   userId: string,
  //   projectId: string,
  //   isPublic: boolean,
  // ): Promise<Project> {
  //   const user = await this.userService.getUser(userId);

  //   // 1) Find the project
  //   const project = await this.projectsRepository.findOne({
  //     where: { id: projectId },
  //   });
  //   if (!project) {
  //     throw new Error('Project not found');
  //   }

  //   this.logger.log(
  //     'check if the github project exist: ' + project.isSyncedWithGitHub,
  //   );
  //   // 2) Check user's GitHub installation
  //   if (!user.githubInstallationId) {
  //     throw new Error('GitHub App not installed for this user');
  //   }

  //   // 3) Get the installation and OAUTH token
  //   const installationToken = await this.gitHubService.getInstallationToken(
  //     user.githubInstallationId,
  //   );
  //   const userOAuthToken = user.githubAccessToken;

  //   // 4) Create the repo if the project doesn't have it yet
  //   if (!project.githubRepoName || !project.githubOwner) {
  //     // Use project.projectName or generate a safe name
  //     const repoName =
  //       project.projectName.replace(/\s+/g, '-').toLowerCase() +
  //       '-' +
  //       'ChangeME';

  //     const { owner, repo, htmlUrl } = await this.gitHubService.createUserRepo(
  //       repoName,
  //       isPublic,
  //       userOAuthToken,
  //     );

  //     project.githubRepoName = repo;
  //     project.githubRepoUrl = htmlUrl;
  //     project.githubOwner = owner;
  //   }

  //   // 5) Recursively push the entire local project folder
  //   const projectPath = getProjectPath(project.projectPath);

  //   await this.gitHubService.pushFolderContent(
  //     installationToken,
  //     project.githubOwner,
  //     project.githubRepoName,
  //     projectPath,
  //     '',
  //   );

  //   // 6) Mark as synced and update DB
  //   project.isSyncedWithGitHub = true;
  //   return this.projectsRepository.save(project);
  // }
}
