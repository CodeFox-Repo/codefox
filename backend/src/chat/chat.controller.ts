import { Controller, Post, Body, Res, UseGuards, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Response } from 'express';
import { ChatService } from './chat.service';
import { ChatRestDto } from './dto/chat-rest.dto';
import { JWTAuthGuard } from '../common/guards/jwt-auth.guard';
import { ChatGuard } from '../common/guards/chat.guard';
import { GetAuthToken } from '../common/decorators/get-auth-token.decorator';
import { streamText } from 'ai';
import { modelFor, DEFAULT_MODEL } from '../common/constants/ai.constants';
import { harnessId, runProjectAgent } from './project-agent';
import { AgentTurn, hash12 } from './agent-turn.model';
import { explain } from './explain-error';
import { MessageRole, TurnStep } from './message.model';
import { WorkspaceService } from '../project/workspace.service';
import type { ChangedFile } from '../project/workspace';
import { lintArtifact, type LintFinding } from './lint-artifact';
import { validateExternalApiBaseUrl } from './external-url';
import {
  atTurnLimit,
  busy,
  queueForProject,
  turnLimit,
  withUserTurn,
} from '../project/project-queue';
import { scenarioOfPage } from '../project/scenarios';
import { clipNotes, HISTORY_TURNS } from './instructions';

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
    @InjectRepository(AgentTurn)
    private readonly turns: Repository<AgentTurn>,
  ) {}

  /**
   * Commit what the turn changed, labelled with the prompt that caused it.
   *
   * Without this a project has exactly one commit — its baseline — and every
   * turn since piles into a single uncommitted diff, so there is nothing to
   * go back to when the agent takes a wrong turn. Best effort by design:
   * bookkeeping must never be what fails a turn the user's files already own.
   *
   * Returns the sha, which the code here used to discard outright. It is the
   * only durable id a turn has, and without it the turn record cannot be
   * joined to the commit a later restore rejects. `null` means the turn
   * changed no files — `snapshot()` checks `git status --porcelain` first, so
   * that is a real answer and not a swallowed failure.
   *
   * `turnId` rides along as a commit trailer so the sha↔turn edge survives the
   * database. Safe because the Changes panel prints `%s` — the subject only
   * (VERSION_LOG_FORMAT in workspace.ts) — and both workspaces use that one
   * format, so nothing user-visible reads the body.
   */
  private async snapshotTurn(
    projectPath: string,
    prompt: string,
    turnId?: string,
  ): Promise<string | null> {
    try {
      const workspace = await this.workspaces.for(projectPath);
      const label = prompt.trim().replace(/\s+/g, ' ').slice(0, 72);
      const subject = label || 'Agent turn';
      return await workspace.snapshot(
        turnId ? `${subject}\n\nCodefox-Turn: ${turnId}` : subject,
      );
    } catch (error) {
      this.logger.warn(`[${projectPath}] snapshot failed: ${error}`);
      return null;
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
   *
   * `pendingEdits()`, NOT `changedFiles()`: the latter diffs against the ROOT
   * commit, so after any turn it lists everything the agent has ever written
   * while the tree is clean vs HEAD. Every turn from the second one on was
   * therefore told "the user edited these files themselves" about the agent's
   * own previous output — and instructed to "keep what they did unless this
   * message asks you to undo it", which is exactly how a follow-up like
   * "make the hero smaller" gets refused as if it contradicted the user.
   */
  private async snapshotPendingEdits(
    projectPath: string,
  ): Promise<{ edited: ChangedFile[]; sha: string | null }> {
    try {
      const workspace = await this.workspaces.for(projectPath);
      // Read the list before committing it — afterwards the tree is clean and
      // there is nothing left to tell the agent about.
      const edited = await workspace.pendingEdits();
      // The sha comes back for the same reason snapshotTurn's does: a `Your
      // edits` commit is the record that the PREVIOUS turn's output was not
      // good enough to leave alone, and it needs to be pointable-at.
      const sha = edited.length ? await workspace.snapshot('Your edits') : null;
      return { edited, sha };
    } catch (error) {
      this.logger.warn(`[${projectPath}] pre-turn snapshot failed: ${error}`);
      return { edited: [], sha: null };
    }
  }

  /**
   * The version the turn starts from, so the range it produced is bounded at
   * both ends. Best effort like every other piece of bookkeeping here — a
   * project with no git, or a sandbox that will not answer, records null.
   */
  private async headSha(projectPath: string): Promise<string | null> {
    try {
      const workspace = await this.workspaces.for(projectPath);
      const versions = await workspace.versions();
      return versions?.find((v) => v.current)?.id ?? versions?.[0]?.id ?? null;
    } catch {
      return null;
    }
  }

  /**
   * One row per turn — the join key nothing else has.
   *
   * A version sha carries no chat, no user, no model and no prompt, so a
   * restore (a human verdict, not self-reported) points at a commit that
   * joins to nothing. This is the edge. Everything else about turn quality is
   * unanswerable without it.
   *
   * Never awaited by the caller, never allowed to throw: like the snapshot and
   * the lint above, this is bookkeeping around work the user's files already
   * own, and it must not be what fails or delays a turn.
   *
   * NOTE ON SECRETS: `chatDto.apiKey` and `chatDto.baseUrl` are never written
   * here, in any column, ever. The DTO says why — storing them would make us a
   * key custodian. Only the boolean that a BYOK endpoint was used.
   */
  private record(turn: Partial<AgentTurn> & { id: string }) {
    void this.turns
      .save(this.turns.create(turn))
      .catch((error) =>
        this.logger.warn(`[${turn.chatId}] turn record failed: ${error}`),
      );
  }

  /**
   * Keep the instructions text once per distinct string, not once per turn.
   *
   * template × scenario is a few dozen strings in total, so the turn row holds
   * a hash and the text lives in a row keyed by it. Upserted on first sight
   * and ignored afterwards — the hash IS the primary key, so a re-insert of
   * the same instructions is a no-op rather than a duplicate.
   */
  private rememberInstructions(hash: string, instructions: string) {
    void this.turns
      .upsert(
        this.turns.create({
          id: hash,
          kind: 'template',
          instructionsHash: hash,
          // The instructions ARE the payload for this row; `userMessage` is
          // the table's one long-text column and reusing it beats a column
          // that only one row kind would ever fill.
          userMessage: instructions,
          promptChars: instructions.length,
        }),
        { conflictPaths: ['id'], skipUpdateIfNoValuesChanged: true },
      )
      .catch((error) =>
        this.logger.warn(`instructions ${hash} not recorded: ${error}`),
      );
  }

  /**
   * What the user said they were making.
   *
   * Page projects carry it in the page's own meta tag — a file, like the
   * design tokens: no column, no migration, no DB_SYNCHRONIZE deploy. A Next
   * app is the 'app' scenario by construction (it is the only next kind
   * today), and its guidance is exactly what a turn needs: the database
   * helper and the component library only help if the model is told.
   */
  private async scenarioOf(project: {
    projectPath: string;
    template?: string | null;
  }): Promise<string | null> {
    if (project.template === 'next') return 'app';
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
   * The project's own notes, if it has written any.
   *
   * A file, like the scenario meta tag and the design tokens — no column, no
   * migration. Capped because it lands in every turn's prompt: a NOTES.md
   * that grows without bound would quietly eat the context window.
   */
  private async notesOf(projectPath: string): Promise<string | null> {
    try {
      const workspace = await this.workspaces.for(projectPath);
      return clipNotes(await workspace.readFile('NOTES.md'));
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

      // A project that exists but has no directory is a failed scaffold, not
      // a chat without a project — and the two are not interchangeable. Both
      // used to land here and get a bare completion: a model with no tools
      // answering "I've built your landing page…" about files it never
      // touched. Say what happened instead of pretending a build ran.
      //
      // As a stream error rather than a throw: the client parses this
      // endpoint as newline-delimited JSON and shows `t: 'error'` to the
      // user, where a 500 surfaces only as a generic "network response was
      // not ok".
      if (project && !projectPath) {
        res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
        res.write(
          `${JSON.stringify({
            t: 'error',
            v: 'This project has no files — its workspace could not be created. Start a new project.',
          })}\n`,
        );
        res.end();
        return;
      }

      if (!projectPath) {
        await this.pipePlainCompletion(chatDto, res);
        return;
      }

      // One account, a handful of turns. The project queue below serialises
      // per PROJECT, so a user with ten projects could otherwise run ten
      // model sessions at once against the shared credit.
      if (atTurnLimit(userId)) {
        res.status(429).json({
          error: `You already have ${turnLimit()} turns running. Wait for one to finish.`,
        });
        return;
      }
      // `userId` from the request, not `project.userId`: on a shared or forked
      // project the owner is not the person typing, and a turn attributed to
      // the owner is attributed to someone who was not there.
      await withUserTurn(userId, () => this.pipeAgent(chatDto, res, userId));
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
  private async pipeAgent(chatDto: ChatRestDto, res: Response, userId: string) {
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
      return this.runTurn(chatDto, res, project, userId);
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
    project: { id?: string; projectPath: string; template?: string | null },
    userId: string,
  ) {
    // Minted here, at the top, rather than in the `finally` that records the
    // turn: the `res.on('close')` rescue-save handler below runs while the
    // turn is still going, and it needs the same id.
    const turnId = randomUUID();
    const startedAt = Date.now();

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
    const { edited: handEdits, sha: handEditSha } =
      await this.snapshotPendingEdits(project.projectPath);

    // Read before the agent runs, so the turn record can point at what the
    // tree looked like going in — the other end of the rolled-back range.
    const parentSha = await this.headSha(project.projectPath);

    const scenarioId = await this.scenarioOf(project);
    const notes = await this.notesOf(project.projectPath);
    const lint =
      project.template === 'html'
        ? await this.lintPage(project.projectPath)
        : [];

    const { result, session, prompt, instructions } = await runProjectAgent({
      projectPath: project.projectPath,
      message: chatDto.message,
      images: chatDto.images,
      history,
      handEdits,
      model: chatDto.model,
      template: project.template,
      scenarioId,
      notes,
      // The same lint that runs at the end of a turn, run again at the start
      // so the agent actually sees it. Recomputed rather than remembered: a
      // restyle, a restore or a hand edit between turns all change what is
      // true of the page, and the findings must describe the file the agent
      // is about to open. Pages only — a Next app has no single artifact to
      // judge, which is the same reason the end-of-turn lint skips it.
      lint,
      // Both or neither: a key with no endpoint would silently fall back to
      // ours and bill us for a turn the user meant to pay for themselves.
      credential:
        chatDto.apiKey && chatDto.baseUrl
          ? {
              apiKey: chatDto.apiKey,
              baseUrl: validateExternalApiBaseUrl(chatDto.baseUrl),
            }
          : undefined,
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

    // Set only by the rescue save below — see the comment there.
    let messageId: string | undefined;

    // The first thing that actually went wrong, for the turn record. First and
    // not last: the later ones are usually consequences of it, and a
    // transient reconnect frame is not one at all (it is filtered below).
    let errorText: string | undefined;

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
    //
    // Bounded, because neither call is guaranteed to return. When the bridge
    // dies mid-turn the harness leaves turnState !== 'idle', so `stop()` goes
    // through suspendCurrentTurn → doSuspendTurn(), a request/response to a
    // process that is already gone — no timeout of its own. Awaiting it here
    // is what left `res.end()` unreached and the composer on "Stop" forever.
    // Losing resume state on a dead runtime costs nothing; hanging costs the
    // whole turn.
    const endSession = async (why: string, abandoned: boolean) => {
      if (stopped) return;
      stopped = true;
      let timer: NodeJS.Timeout | undefined;
      try {
        await Promise.race([
          abandoned ? session.destroy?.() : session.stop?.(),
          new Promise((_, reject) => {
            timer = setTimeout(
              () => reject(new Error(`${why} timed out after 30s`)),
              30_000,
            );
          }),
        ]);
      } catch (error) {
        this.logger.warn(`[${chatDto.chatId}] ${why} failed: ${error}`);
      } finally {
        clearTimeout(timer);
      }
    };
    res.on('close', () => {
      clientGone = true;
      void endSession('destroy', true);
      if (!finished && reply.trim()) {
        void this.chatService
          .saveMessage(chatDto.chatId, reply, MessageRole.Assistant, steps)
          // The one path where the backend learns the message id at all — a
          // reply the client received is saved by the browser, which never
          // tells us what id it got. So `messageId` is populated on abandoned
          // turns and null on the rest; a digest joining on it must expect
          // that rather than read null as "no message".
          .then((message) => {
            if (message?.id) messageId = message.id;
          })
          .catch((error) =>
            this.logger.warn(
              `[${chatDto.chatId}] could not save the abandoned reply: ${error}`,
            ),
          );
      }
    });

    // The stream can go silent forever in more than one shape, and none of
    // them end it, so the loop is always racing a deadline. Silence is what
    // is fatal, not duration — a build turn runs 9-10min but emits parts
    // throughout — so every part resets the clock.
    //
    // Two known shapes, both ending in a promise nobody holds:
    //
    // 1. A "Reconnecting... 1/5" frame. That is the codex CLI's own retry,
    //    surfaced as a bridge error frame — and the harness settles the turn
    //    on ANY error frame (codex-harness.ts `channel.on('error')` →
    //    settleError). So by the time the filter below swallows 1/5 the turn
    //    is already dead: no 2/5, no exhaustion, nothing terminal. Swallowing
    //    it is still right (the CLI does retry internally, and killing a
    //    recoverable turn was the older bug), so it tightens the deadline
    //    rather than failing the turn outright. r3-backend-8081.log: one 1/5
    //    at 12:10:11, that chat never logs another line.
    //
    // 2. A bridge that closes with NO reconnect frame, which arms nothing.
    //    onClose → settleError only calls `pendingReject`, landing on the
    //    `done` promise `agent.stream()` discards. r5-backend.log has two —
    //    last tool frame 1:43:24, `codex bridge closed` logged, then not one
    //    ChatController line until the next turn at 1:52:12. The response was
    //    never ended, so the client was right to keep showing it running.
    //
    // Assume there are more shapes than these two: the deadline is armed for
    // the whole turn rather than per known cause.
    //
    // UNCONFIRMED, for whoever upgrades the harness: shape 2 may be a stall
    // in SandboxChannel's dispatch serialization rather than a lost
    // rejection. `enqueue` chains onto one promise
    // (harness/dist/utils/index.js:263, `dispatchChain.then(work)`) and
    // finalizeClose is enqueued onto it (:178), so a `handleIncoming` (:267)
    // still awaiting its async parse/validate would park finalizeClose behind
    // it indefinitely. Worth re-testing on upgrade; the guard covers us
    // either way.
    //
    // ponytail: 5min silence, 90s once a reconnect has made the stream
    // suspect. Both past any real gap between parts (r5's longest is ~30s).
    const IDLE_MS = 5 * 60_000;
    const RECONNECT_SILENCE_MS = 90_000;
    let deadline: NodeJS.Timeout | undefined;
    let stalled: Promise<never> | undefined;
    const armed = (ms = RECONNECT_SILENCE_MS) => {
      stalled = new Promise<never>((_, reject) => {
        deadline = setTimeout(
          () =>
            reject(
              new Error(
                'The agent lost its connection and could not get it back.',
              ),
            ),
          ms,
        );
      });
    };
    const disarm = () => {
      clearTimeout(deadline);
      deadline = undefined;
      stalled = undefined;
    };
    const iterator = result.stream[Symbol.asyncIterator]();
    armed(IDLE_MS);

    try {
      for (;;) {
        const next = await Promise.race([iterator.next(), stalled!]);
        if (next.done) break;
        const part = next.value;
        // Any part means the stream is alive; back to the loose deadline.
        if (part.type !== 'error') {
          disarm();
          armed(IDLE_MS);
        }
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
              // Still transient — but from here silence is a dead socket, not
              // a long think, so start the clock. Re-armed on each attempt.
              disarm();
              armed();
              break;
            }
            this.logger.error(`[${chatDto.chatId}] ${JSON.stringify(part)}`);
            errorText ??= detail || JSON.stringify(part);
            send({ t: 'error', v: explain((part as any).error ?? part) });
            break;
          }
        }
      }
    } catch (error) {
      this.logger.error(`[${chatDto.chatId}] ${error.message}`, error.stack);
      errorText ??= String(error?.message ?? error);
      if (!res.writableEnded) send({ t: 'error', v: explain(error) });
    } finally {
      disarm();
      // Frees the bridge and its port. The project directory is the user's,
      // so the session is stopped rather than destroyed.
      await endSession('stop', false);
      // Before `end()`, and after the session so the agent's last writes have
      // landed. A client that asks for the history the moment the stream
      // closes — which is exactly when the UI refreshes — must not see the
      // turn missing from it. A turn that failed part-way still snapshots:
      // those edits are real, and are the ones someone wants to undo.
      const sha = await this.snapshotTurn(
        project.projectPath,
        chatDto.message,
        turnId,
      );

      // Here, in the `finally`, so a turn that errored or that the user walked
      // away from is recorded too — those are the highest-value negative
      // samples and the ones a `try`-side insert would miss. After the
      // snapshot, so `sha` exists; before `finished`, so the row lands whether
      // or not the client is still listening. Never awaited: see `record`.
      const instructionsHash = hash12(instructions);
      this.rememberInstructions(instructionsHash, instructions);
      this.record({
        id: turnId,
        kind: 'turn',
        chatId: chatDto.chatId,
        userId,
        projectPath: project.projectPath,
        projectId: project.id ?? null,
        template: project.template ?? null,
        scenarioId,
        // The DTO's model, not Chat.model: that one is mutable and this
        // request may have overridden it.
        model: chatDto.model ?? null,
        harness: harnessId(),
        // The boolean and nothing else. The key and the endpoint are not
        // written anywhere, by anything.
        byok: Boolean(chatDto.apiKey && chatDto.baseUrl),
        sha,
        parentSha,
        handEditSha,
        turnIndex: stored.length,
        messageId: messageId ?? null,
        historyTurns: Math.min(history.length, HISTORY_TURNS),
        instructionsHash,
        promptHash: hash12(prompt),
        promptChars: prompt.length,
        userMessage: chatDto.message,
        // Only what cannot be rebuilt from data we already hold. The retold
        // history is deliberately absent — it is a pure function of
        // Chat.messages, and copying it per turn grows quadratically with the
        // conversation. Images are counted, never stored: a screenshot is the
        // likeliest place here for personal data nobody can redact.
        contextJson: {
          notes,
          handEdits,
          lint,
          images: chatDto.images?.length ?? 0,
        },
        reply,
        steps,
        stepCount: steps.length,
        toolCalls: steps.filter((step) => step.kind === 'tool').length,
        errored: Boolean(errorText),
        errorText: errorText ?? null,
        abandoned: clientGone,
        durationMs: Date.now() - startedAt,
      });

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
      model: modelFor(chatDto.model || DEFAULT_MODEL),
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
