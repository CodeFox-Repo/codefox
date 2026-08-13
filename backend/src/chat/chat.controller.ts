import { Controller, Post, Body, Res, UseGuards, Logger } from '@nestjs/common';
import { Response } from 'express';
import { ChatService } from './chat.service';
import { ChatRestDto } from './dto/chat-rest.dto';
import { JWTAuthGuard } from '../common/guards/jwt-auth.guard';
import { ChatGuard } from '../common/guards/chat.guard';
import { GetAuthToken } from '../common/decorators/get-auth-token.decorator';
import { streamText } from 'ai';
import { openrouter, DEFAULT_MODEL } from '../common/constants/ai.constants';
import { runProjectAgent } from './project-agent';
import { explain } from './explain-error';
import { MessageRole, TurnStep } from './message.model';
import { WorkspaceService } from '../project/workspace.service';
import type { ChangedFile } from '../project/workspace';
import { lintArtifact, type LintFinding } from './lint-artifact';
import { busy, queueForProject } from '../project/project-queue';
import { scenarioOfPage } from '../project/scenarios';

/**
 * Best-effort label for what a tool call is acting on. Tool arguments arrive as
 * a JSON string whose shape is the tool's own, so this reads the keys the
 * built-in file tools happen to use and gives up quietly otherwise.
 */
const PATH_KEYS = ['file_path', 'filePath', 'path', 'notebook_path'];

const targetOf = (input: unknown): string | undefined => {
  // Typed as a string, but tolerate an already-parsed object: the label is a
  // nicety and must never be the reason a turn fails.
  let args: any = input;
  if (typeof args === 'string') {
    try {
      args = JSON.parse(args);
    } catch {
      return args.length <= 40 ? args : undefined;
    }
  }
  if (!args || typeof args !== 'object') return undefined;

  for (const key of PATH_KEYS) {
    const value = args[key];
    if (typeof value === 'string' && value) return value.split('/').pop();
  }
  if (typeof args.command === 'string') return args.command.slice(0, 40);
  if (typeof args.pattern === 'string') return args.pattern.slice(0, 40);
  return undefined;
};

@Controller('api/chat')
@UseGuards(JWTAuthGuard, ChatGuard)
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly workspaces: WorkspaceService,
  ) {}

  /**
   * Commit what the turn changed, labelled with the prompt that caused it.
   *
   * Without this a project has exactly one commit — its baseline — and every
   * turn since piles into a single uncommitted diff, so there is nothing to
   * go back to when the agent takes a wrong turn. Best effort by design:
   * bookkeeping must never be what fails a turn the user's files already own.
   */
  private async snapshotTurn(projectPath: string, prompt: string) {
    try {
      const workspace = await this.workspaces.for(projectPath);
      const label = prompt.trim().replace(/\s+/g, ' ').slice(0, 72);
      await workspace.snapshot(label || 'Agent turn');
    } catch (error) {
      this.logger.warn(`[${projectPath}] snapshot failed: ${error}`);
    }
  }

  /**
   * Give the user's own edits a version before the agent runs.
   *
   * Files edited by hand in the editor are not committed by anything — only
   * turns commit. So a turn's snapshot swept whatever the user had typed into
   * the agent's commit, under the agent's prompt as its label: restoring to
   * "before that turn" threw away work the user did themselves, and the
   * history credited it to the agent. A no-op when the tree is already clean,
   * which is the common case.
   */
  private async snapshotPendingEdits(
    projectPath: string,
  ): Promise<ChangedFile[]> {
    try {
      const workspace = await this.workspaces.for(projectPath);
      // Read the list before committing it — afterwards the tree is clean and
      // there is nothing left to tell the agent about.
      const edited = (await workspace.changedFiles()) ?? [];
      if (edited.length) await workspace.snapshot('Your edits');
      return edited;
    } catch (error) {
      this.logger.warn(`[${projectPath}] pre-turn snapshot failed: ${error}`);
      return [];
    }
  }

  /**
   * What the user said they were making, from the page's own meta tag.
   *
   * Stored in the file rather than a column: the same trick the design system
   * uses, and it means no migration and no DB_SYNCHRONIZE deploy. Null for a
   * Next app or a page scaffolded before scenarios existed — the agent then
   * gets its plain instructions, which is what it had all along.
   */
  private async scenarioOf(project: {
    projectPath: string;
    template?: string | null;
  }): Promise<string | null> {
    if (project.template !== 'html') return null;
    try {
      const workspace = await this.workspaces.for(project.projectPath);
      const html = await workspace.readFile('index.html');
      return scenarioOfPage(html);
    } catch {
      return null;
    }
  }

  /**
   * What the page the turn just produced gets wrong, as design findings.
   *
   * Only page projects have a single artifact to judge — a Next app is a
   * tree, and there is no one file that is "the design". Advisory by
   * definition: the files are already written, so a lint that throws must
   * not be what fails a turn that otherwise succeeded.
   */
  private async lintPage(projectPath: string): Promise<LintFinding[]> {
    try {
      const workspace = await this.workspaces.for(projectPath);
      const html = await workspace.readFile('index.html');
      // ponytail: 2MB is well past any hand-written page; past that the
      // regex sweep costs more than the advice is worth.
      if (!html || html.length > 2_000_000) return [];
      return lintArtifact(html);
    } catch (error) {
      this.logger.warn(`[${projectPath}] lint failed: ${error}`);
      return [];
    }
  }

  @Post()
  async chat(
    @Body() chatDto: ChatRestDto,
    @Res() res: Response,
    @GetAuthToken() userId: string,
  ) {
    try {
      // A chat bound to a scaffolded project gets the Claude Code agent, which
      // can actually read and write that project. Anything else is a plain
      // completion — there is no working directory to act on.
      const project = await this.chatService.getProjectByChatId(chatDto.chatId);
      const projectPath = project?.projectPath;

      if (!projectPath) {
        await this.pipePlainCompletion(chatDto, res);
        return;
      }

      await this.pipeAgent(chatDto, res);
    } catch (error) {
      this.logger.error(`Chat error: ${error.message}`, error.stack);
      if (!res.headersSent) {
        res.status(500).json({ error: 'An error occurred during chat' });
      } else {
        res.end();
      }
    }
  }

  /**
   * Stream the agent turn as newline-delimited JSON events.
   *
   * Not the AI SDK UIMessage protocol: that assumes a `streamText` result, and
   * a HarnessAgent emits its own part stream. Forwarding those parts directly
   * is less code than synthesising UIMessage chunks, and it carries the two
   * things a plain text stream drops — which tool is running and which files
   * changed — so the UI can show progress instead of a blank wait.
   */
  private async pipeAgent(chatDto: ChatRestDto, res: Response) {
    const project = await this.chatService.getProjectByChatId(chatDto.chatId);

    // One turn at a time per project. Two turns used to run against the same
    // working directory at once: both agents rewrote the same files, both
    // reported success, and whichever finished second committed a tree that
    // had already been overwritten — so one whole turn's work vanished with
    // no error anywhere. Observed directly: two concurrent rewrites produced
    // one version, and the other turn's changes were simply gone.
    const path = project.projectPath;
    const ahead = busy(path);

    // Shared with restyle, which also writes index.html — two independent
    // queues would not have stopped them racing each other.
    const mine = queueForProject(path, () => {
      // A client that hung up while waiting should not start an agent.
      if (res.writableEnded || res.destroyed) return Promise.resolve();
      return this.runTurn(chatDto, res, project);
    });

    // Say so rather than leave the user watching a silent stream: a queued
    // turn can wait as long as the one ahead of it takes.
    if (ahead) {
      res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('X-Accel-Buffering', 'no');
      res.write(
        `${JSON.stringify({ t: 'text', v: 'Waiting for this project’s current turn to finish…\n\n' })}\n`,
      );
    }

    return mine;
  }

  private async runTurn(
    chatDto: ChatRestDto,
    res: Response,
    project: { projectPath: string; template?: string | null },
  ) {
    // The client saves the user's message before it calls this, so the stored
    // history already ends with the very message being asked now. Replaying it
    // would show the agent the question twice.
    const stored = await this.chatService.getChatHistory(chatDto.chatId);
    const history = stored.map((message) => ({
      role: String(message.role),
      content: message.content,
    }));
    const last = history[history.length - 1];
    if (
      last &&
      !/assistant/i.test(last.role) &&
      last.content === chatDto.message
    ) {
      history.pop();
    }

    // Before the agent touches anything, so hand edits stay the user's own
    // version rather than being folded into the agent's commit. The list also
    // becomes context: an agent that does not know the user just rewrote a
    // file will happily rewrite it back.
    const handEdits = await this.snapshotPendingEdits(project.projectPath);

    const { result, session } = await runProjectAgent({
      projectPath: project.projectPath,
      message: chatDto.message,
      images: chatDto.images,
      history,
      handEdits,
      model: chatDto.model,
      template: project.template,
      scenarioId: await this.scenarioOf(project),
    });

    // Already sent when this turn waited in the queue and said so.
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('X-Accel-Buffering', 'no');
    }

    const send = (event: Record<string, unknown>) =>
      res.write(`${JSON.stringify(event)}\n`);

    // A client that hangs up mid-turn should stop the agent, not leak a session.
    //
    // Stopping here rather than only after the loop notices: the loop is
    // parked on `await` for the model's next part, so a turn abandoned during
    // inference never reached the flag — and the bridge process, holding its
    // model connection open, outlived the request indefinitely.
    let clientGone = false;
    let stopped = false;
    // `close` fires on a normal end too — `res.end()` closes the connection —
    // so without knowing the turn already finished, the rescue save below ran
    // on every turn and every reply was stored twice: once here, once by the
    // client that received it.
    let finished = false;

    // What the model has said so far. The browser is what normally persists a
    // reply, at the end of the stream — so a turn the user walked away from
    // left the chat showing a question with no answer, next to files the agent
    // had already changed. Whatever the client never received, this saves.
    let reply = '';

    // The same shape the client saves, so a turn the user walked away from
    // reloads with its working notes intact rather than as one flat blob.
    const steps: TurnStep[] = [];
    const addText = (text: string) => {
      const last = steps[steps.length - 1];
      if (last?.kind === 'text') last.text += text;
      else steps.push({ kind: 'text', text });
    };
    // `stop` persists resume state and leaves the runtime to be picked up
    // again; on a host sandbox that means the bridge process survives, which
    // is a leak when nobody is coming back. An abandoned turn is not resumed
    // — the UI starts a fresh one — so it gets `destroy`, which ends the
    // runtime outright.
    const endSession = async (why: string, abandoned: boolean) => {
      if (stopped) return;
      stopped = true;
      try {
        await (abandoned ? session.destroy?.() : session.stop?.());
      } catch (error) {
        this.logger.warn(`[${chatDto.chatId}] ${why} failed: ${error}`);
      }
    };
    res.on('close', () => {
      clientGone = true;
      void endSession('destroy', true);
      if (!finished && reply.trim()) {
        void this.chatService
          .saveMessage(chatDto.chatId, reply, MessageRole.Assistant, steps)
          .catch((error) =>
            this.logger.warn(
              `[${chatDto.chatId}] could not save the abandoned reply: ${error}`,
            ),
          );
      }
    });

    // A dead bridge never ends this stream. `agent.stream()` drops the `done`
    // promise that `generate()` awaits, and that promise is the only thing the
    // adapter rejects when the bridge closes mid-turn ("codex bridge closed
    // before the turn finished") — no `finish` part is ever emitted. So the
    // `for await` below parks forever, `res.end()` never runs, and the composer
    // sits on "Stop" until the user reloads. Watched for 10 minutes.
    //
    // ponytail: a silence timer, not a turn deadline — a working turn can think
    // for minutes between parts, and a wall-clock cap would kill it. Raise
    // SILENCE_MS if a model legitimately goes quiet longer than this.
    const SILENCE_MS = 5 * 60_000;
    let ticker: NodeJS.Timeout | undefined;
    const silence = () =>
      new Promise<never>((_, reject) => {
        ticker = setTimeout(
          () =>
            reject(
              new Error(
                'The agent stopped responding — its runtime went away.',
              ),
            ),
          SILENCE_MS,
        );
      });
    let silent = silence();
    const iterator = result.stream[Symbol.asyncIterator]();

    try {
      for (;;) {
        // Whichever settles first: the next part, or the silence deadline.
        const next = await Promise.race([iterator.next(), silent]);
        if (next.done) break;
        const part = next.value;
        // Restart the clock on every part, so only silence trips it.
        clearTimeout(ticker);
        silent = silence();

        if (clientGone) break;

        switch (part.type) {
          case 'text-delta':
            reply += part.text;
            addText(part.text);
            send({ t: 'text', v: part.text });
            break;
          case 'tool-call':
            this.logger.debug(`[${chatDto.chatId}] tool ${part.toolName}`);
            // `file-change` parts are adapter-level and never reach the agent
            // stream, so the target comes from the call's own arguments.
            steps.push({
              kind: 'tool',
              tool: part.toolName,
              file: targetOf(part.input),
            });
            send({
              t: 'tool',
              v: part.toolName,
              arg: targetOf(part.input),
            });
            break;
          case 'error': {
            // The harness reports its own reconnect attempts as error frames
            // ("Reconnecting... 1/5"). Those are transients it is already
            // handling — surfacing them killed turns that were about to
            // recover. A reconnect that fails for good ends the stream, and
            // the catch below owns that.
            const detail = String((part as any).error ?? '');
            if (/^Reconnecting\.\.\./.test(detail)) {
              this.logger.warn(`[${chatDto.chatId}] transient: ${detail}`);
              break;
            }
            this.logger.error(`[${chatDto.chatId}] ${JSON.stringify(part)}`);
            send({ t: 'error', v: explain((part as any).error ?? part) });
            break;
          }
        }
      }
    } catch (error) {
      this.logger.error(`[${chatDto.chatId}] ${error.message}`, error.stack);
      if (!res.writableEnded) send({ t: 'error', v: explain(error) });
    } finally {
      // Or the last one keeps the process awake for its full delay.
      clearTimeout(ticker);
      // Frees the bridge and its port. The project directory is the user's,
      // so the session is stopped rather than destroyed.
      await endSession('stop', false);
      // Before `end()`, and after the session so the agent's last writes have
      // landed. A client that asks for the history the moment the stream
      // closes — which is exactly when the UI refreshes — must not see the
      // turn missing from it. A turn that failed part-way still snapshots:
      // those edits are real, and are the ones someone wants to undo.
      await this.snapshotTurn(project.projectPath, chatDto.message);
      // After the session, for the same reason the snapshot is: the agent's
      // last writes have to have landed or the lint reads the previous page.
      if (project.template === 'html' && !clientGone && !res.writableEnded) {
        const findings = await this.lintPage(project.projectPath);
        if (findings.length) send({ t: 'lint', v: findings });
      }
      // Last, immediately before `end()`. It used to be set at the top of this
      // block, ahead of the session stop, the snapshot and the lint — three
      // awaits, seconds of them. A client that hung up in that window was
      // treated as a finished turn, so the rescue save was skipped for a reply
      // it had never received: the answer existed only in this function and
      // died with it. The close handler runs after this line, so setting it
      // here still stops the double save on a normal end.
      finished = true;
      res.end();
    }
  }

  /**
   * Same newline-delimited JSON protocol as `pipeAgent`. It used to write the
   * raw text stream instead, which the client — a JSON-per-line parser —
   * dropped line by line, so a chat with no project answered with silence.
   */
  private async pipePlainCompletion(chatDto: ChatRestDto, res: Response) {
    // A provider error does not reject `textStream` — the iteration simply
    // ends — so without this the whole turn came back as an empty 201 and the
    // user watched a chat that answered nothing and complained about nothing.
    let failure: unknown;

    const result = streamText({
      model: openrouter(chatDto.model || DEFAULT_MODEL),
      prompt: chatDto.message,
      onError: ({ error }) => {
        failure = error;
      },
    });

    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');

    let clientGone = false;
    res.on('close', () => {
      clientGone = true;
    });

    try {
      for await (const delta of result.textStream) {
        if (clientGone) break;
        res.write(`${JSON.stringify({ t: 'text', v: delta })}\n`);
      }
      if (failure) throw failure;
    } catch (error) {
      this.logger.error(`[${chatDto.chatId}] ${error?.message ?? error}`);
      if (!res.writableEnded) {
        res.write(`${JSON.stringify({ t: 'error', v: explain(error) })}\n`);
      }
    } finally {
      res.end();
    }
  }
}
