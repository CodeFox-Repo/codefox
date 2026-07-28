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

  constructor(private readonly chatService: ChatService) {}

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

    const { result, session } = await runProjectAgent({
      projectPath: project.projectPath,
      message: chatDto.message,
      images: chatDto.images,
      history,
      model: chatDto.model,
      template: project.template,
    });

    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');

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

    try {
      for await (const part of result.stream) {
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
          case 'error':
            this.logger.error(`[${chatDto.chatId}] ${JSON.stringify(part)}`);
            send({ t: 'error', v: explain((part as any).error ?? part) });
            break;
        }
      }
    } catch (error) {
      this.logger.error(`[${chatDto.chatId}] ${error.message}`, error.stack);
      if (!res.writableEnded) send({ t: 'error', v: explain(error) });
    } finally {
      // Set before `end()`: the close handler must be able to tell a finished
      // turn from an abandoned one, and it runs after this.
      finished = true;
      res.end();
      // Frees the bridge and its port. The project directory is the user's,
      // so the session is stopped rather than destroyed.
      await endSession('stop', false);
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
