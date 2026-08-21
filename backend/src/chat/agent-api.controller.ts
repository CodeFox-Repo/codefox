import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpException,
  Logger,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Request, Response } from 'express';
import { JWTAuthGuard } from '../common/guards/jwt-auth.guard';
import { DEFAULT_MODEL } from '../common/constants/ai.constants';
import { Project } from '../project/project.model';
import { WorkspaceService } from '../project/workspace.service';
import { atTurnLimit, busy, turnLimit } from '../project/project-queue';
import { sandboxMode } from './sandbox-provider';
import { AgentTurn } from './agent-turn.model';
import { Chat } from './chat.model';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { MessageRole } from './message.model';
import { HeadlessResponse } from './headless-turn';
import { agentOrigin } from './agent-origin';
import type { ChatRestDto } from './dto/chat-rest.dto';

/** A project id is a uuid; anything else is not worth a database round trip. */
const UUID = /^[0-9a-f-]{36}$/i;

/**
 * The product's surface for a coding agent that is not a browser.
 *
 * Claude Code, Codex or Cursor running in someone's terminal can talk to a
 * project here: send a message, watch the turn, read the reply, and collect
 * the links that show what was built. Everything below is a thin facade —
 * turns run through `ChatController` unchanged, so the queue, the snapshot,
 * the turn record and the stall watchdog all still apply.
 *
 * Owner-only, on a signed token, like every other REST route here. A public
 * project is readable anonymously through `/share`, which is what that route
 * is for; nothing in this file opens a second anonymous door.
 *
 * See docs/remote-agent-api.md for why this is REST and not an MCP server.
 */
@Controller('api/agent')
@UseGuards(JWTAuthGuard)
export class AgentApiController {
  private readonly logger = new Logger(AgentApiController.name);

  /**
   * Projects with a headless turn on the way in.
   *
   * `busy()` only goes true once `pipeAgent` reaches `queueForProject`, an
   * await or two after the POST has already answered. A caller that polls
   * immediately would see `running: false` in that window and read it as
   * "finished" — with no reply in the chat, because the turn had not started.
   *
   * A count and not a set: two messages sent in a row against one project are
   * two headless turns, and the first to finish must not clear the flag out
   * from under the second.
   *
   * ponytail: in-process, same ceiling as every other queue here (project-
   * queue.ts). A second backend instance would need the same real lock.
   */
  private static readonly starting = new Map<string, number>();

  constructor(
    private readonly chats: ChatService,
    // A controller as a provider: turns must run through the real one, and
    // this is cheaper than lifting 300 lines of `runTurn` out of it. It holds
    // no per-request state, so a second instance costs nothing.
    private readonly chatController: ChatController,
    private readonly workspaces: WorkspaceService,
    @InjectRepository(Project)
    private readonly projects: Repository<Project>,
    @InjectRepository(Chat)
    private readonly chatRows: Repository<Chat>,
    @InjectRepository(AgentTurn)
    private readonly turns: Repository<AgentTurn>,
  ) {}

  /** Every project this token's owner has, newest first. */
  @Get('projects')
  async list(@Req() req: Request) {
    const userId = this.userOf(req);
    const rows = await this.projects.find({
      where: { userId, isDeleted: false },
      order: { updatedAt: 'DESC' },
    });

    return {
      projects: await Promise.all(
        rows.map(async (project) => ({
          id: project.id,
          projectName: project.projectName,
          projectPath: project.projectPath || null,
          template: project.template,
          isPublic: project.isPublic,
          chatId: (await this.chatOf(project, false))?.id ?? null,
          scaffolded: Boolean(project.projectPath),
          running: this.running(project.projectPath),
          updatedAt: project.updatedAt,
        })),
      ),
    };
  }

  /** Where this project is right now: still building, mid-turn, or idle. */
  @Get('projects/:id')
  async status(@Req() req: Request, @Param('id') id: string) {
    const project = await this.own(id, req);
    const chat = await this.chatOf(project, false);
    const messages = chat ? await this.chats.getChatHistory(chat.id) : [];

    // projectPath, not projectId: it is the indexed column and it is set on
    // every row, including the ones written before projectId existed.
    const last = project.projectPath
      ? await this.turns.findOne({
          where: { kind: 'turn', projectPath: project.projectPath },
          order: { createdAt: 'DESC' },
        })
      : null;

    return {
      id: project.id,
      projectName: project.projectName,
      projectPath: project.projectPath || null,
      template: project.template,
      isPublic: project.isPublic,
      chatId: chat?.id ?? null,
      // False means the workspace is still being created — or that its
      // scaffold failed, which looks the same from here and is why a turn is
      // refused rather than run against a directory that does not exist.
      scaffolded: Boolean(project.projectPath),
      running: this.running(project.projectPath),
      messageCount: messages.length,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      // The authoritative outcome of the last turn. A turn that failed leaves
      // no assistant message at all, so this is the only place its error
      // shows up.
      lastTurn: last && {
        id: last.id,
        at: last.createdAt,
        model: last.model,
        harness: last.harness,
        durationMs: last.durationMs,
        toolCalls: last.toolCalls,
        errored: last.errored,
        errorText: last.errorText,
        abandoned: last.abandoned,
        /** The commit it produced, or null when it changed no files. */
        sha: last.sha,
        userMessage: last.userMessage,
        replyChars: last.reply?.length ?? 0,
      },
    };
  }

  /**
   * Say something to the project's agent. Returns as soon as the turn is on
   * its way — a build turn runs for minutes, which is longer than any tool
   * call should hold a socket open. Poll `GET /api/agent/projects/:id` until
   * `running` goes false, then read the messages.
   */
  @Post('projects/:id/messages')
  async send(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { message?: string; model?: string },
  ) {
    const project = await this.own(id, req);
    const message =
      typeof body?.message === 'string' ? body.message.trim() : '';
    if (!message) throw new BadRequestException('Missing message');
    if (!project.projectPath) {
      throw new ConflictException(
        'This project has no files yet — it is still being created, or its scaffold failed.',
      );
    }

    const userId = this.userOf(req);
    // Checked here as well as inside the controller: past this point the turn
    // is detached, so a 429 raised in there would answer nobody.
    if (atTurnLimit(userId)) {
      throw new HttpException(
        `You already have ${turnLimit()} turns running. Wait for one to finish.`,
        429,
      );
    }

    const chat = await this.chatOf(project, true);
    const queued = this.running(project.projectPath);
    // The browser saves the user's message before it calls /api/chat, and
    // `runTurn` relies on that — it pops the trailing history entry when it
    // matches the message being asked. Same order here.
    await this.chats.saveMessage(chat.id, message, MessageRole.User);

    this.startTurn({
      chatId: chat.id,
      message,
      model: body?.model || chat.model || DEFAULT_MODEL,
      projectPath: project.projectPath,
      userId,
    });

    return {
      projectId: project.id,
      chatId: chat.id,
      // 'queued' means something else is already writing this project; the
      // turn runs when that one finishes.
      status: queued ? 'queued' : 'started',
      poll: `/api/agent/projects/${project.id}`,
    };
  }

  /** The conversation, oldest first. Default the last 20 messages. */
  @Get('projects/:id/messages')
  async messages(
    @Req() req: Request,
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    const project = await this.own(id, req);
    const chat = await this.chatOf(project, true);
    const history = await this.chats.getChatHistory(chat.id);
    const take = Math.min(Math.max(Number(limit) || 20, 1), 200);

    return {
      chatId: chat.id,
      total: history.length,
      messages: history.slice(-take).map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
      })),
    };
  }

  /**
   * Where to look at what was built.
   *
   * `share` and `live` are anonymous and only exist once the owner has made
   * the project public. `entry` and `files` are this API's own routes and
   * need the same bearer token — they are how a private project gets read.
   */
  @Get('projects/:id/links')
  async links(
    @Req() req: Request,
    @Param('id') id: string,
    @Query('start') start?: string,
  ) {
    const project = await this.own(id, req);
    const origin = agentOrigin(req);
    const path = project.projectPath;
    const isPage = project.template === 'html';

    // Booting a dev server is up to 90 seconds and several hundred megabytes,
    // so it is opt-in: asking where a project lives must not start one.
    let preview: { url: string; requiresPreviewCookie: boolean } | null = null;
    if (path && (start === '1' || start === 'true')) {
      const workspace = await this.workspaces.for(path);
      const { url } = await workspace.startPreview();
      preview = {
        url,
        // On the host the dev server binds to loopback and is reached through
        // this origin's cookie-keyed proxy, so this URL is not fetchable from
        // anywhere else. Said out loud rather than handed over as if it were.
        requiresPreviewCookie: sandboxMode() === 'host',
      };
    }

    return {
      projectPath: path || null,
      template: project.template,
      isPublic: project.isPublic,
      share: project.isPublic
        ? `${origin}/share/${project.uniqueProjectId}`
        : null,
      live:
        project.isPublic && !isPage
          ? `${origin}/api/live/${project.uniqueProjectId}`
          : null,
      entry:
        path && isPage ? `${origin}/api/file?path=${path}/index.html` : null,
      files: path ? `${origin}/api/project?path=${path}` : null,
      preview,
    };
  }

  /**
   * Run the turn with nobody holding the socket.
   *
   * Detached on purpose: the HTTP request that started it is already gone.
   * `chat()` resolves when the turn is over, and the reply that a browser
   * would have posted back is saved here instead — see HeadlessResponse.
   */
  private startTurn(turn: {
    chatId: string;
    message: string;
    model: string;
    projectPath: string;
    userId: string;
  }) {
    const starting = AgentApiController.starting;
    starting.set(turn.projectPath, (starting.get(turn.projectPath) ?? 0) + 1);
    const sink = new HeadlessResponse();

    void (async () => {
      try {
        await this.chatController.chat(
          {
            chatId: turn.chatId,
            message: turn.message,
            model: turn.model,
          } as ChatRestDto,
          sink as unknown as Response,
          turn.userId,
        );

        if (sink.statusCode >= 400) {
          this.logger.warn(
            `[${turn.chatId}] turn refused: ${JSON.stringify(sink.body)}`,
          );
        }
        // Only what the model actually said. An errored turn with no text
        // stays absent from the chat rather than getting a fabricated
        // assistant message — `lastTurn.errorText` is where that lives.
        if (sink.reply.trim()) {
          await this.chats.saveMessage(
            turn.chatId,
            sink.reply,
            MessageRole.Assistant,
            sink.steps,
          );
        }
        if (sink.errors.length) {
          this.logger.warn(`[${turn.chatId}] ${sink.errors.join(' | ')}`);
        }
      } catch (error) {
        this.logger.error(`[${turn.chatId}] headless turn failed: ${error}`);
      } finally {
        const left = (starting.get(turn.projectPath) ?? 1) - 1;
        if (left > 0) starting.set(turn.projectPath, left);
        else starting.delete(turn.projectPath);
      }
    })();
  }

  /** True while anything is writing this project — a turn, a restyle, a deploy. */
  private running(projectPath: string | null): boolean {
    return Boolean(
      projectPath &&
        (AgentApiController.starting.get(projectPath) || busy(projectPath)),
    );
  }

  private userOf(req: Request): string {
    // Set by JWTAuthGuard once it has verified the signature, checked the
    // token against the logout cache and confirmed the account is live.
    const userId = (req as any).user?.userId;
    if (!userId) throw new ForbiddenException('Not signed in');
    return userId;
  }

  /**
   * The caller's own project, by id.
   *
   * Not `assertProjectAccess`: that one is keyed on the directory name, which
   * a project being scaffolded does not have yet — and "still creating" is
   * exactly the state this API exists to report. Owner-only, so the public
   * read that helper allows would be wrong here anyway.
   */
  private async own(id: string, req: Request): Promise<Project> {
    const userId = this.userOf(req);
    if (!UUID.test(id ?? '')) throw new NotFoundException('No such project');

    const project = await this.projects.findOne({
      where: { id, isDeleted: false },
    });
    if (!project) throw new NotFoundException('No such project');
    if (project.userId !== userId) {
      throw new ForbiddenException('This project is not yours');
    }
    return project;
  }

  /** The project's conversation — the newest one, if it somehow has several. */
  private async chatOf(project: Project, required: boolean): Promise<Chat> {
    const chat = await this.chatRows.findOne({
      where: { project: { id: project.id }, isDeleted: false },
      order: { createdAt: 'DESC' },
    });
    if (!chat && required) {
      throw new NotFoundException('This project has no chat to talk to');
    }
    return chat;
  }
}
