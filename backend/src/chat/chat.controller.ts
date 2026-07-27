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
    const { result, session } = await runProjectAgent({
      projectPath: project.projectPath,
      message: chatDto.message,
      images: chatDto.images,
      model: chatDto.model,
    });

    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');

    const send = (event: Record<string, unknown>) =>
      res.write(`${JSON.stringify(event)}\n`);

    // A client that hangs up mid-turn should stop the agent, not leak a session.
    let clientGone = false;
    res.on('close', () => {
      clientGone = true;
    });

    try {
      for await (const part of result.stream) {
        if (clientGone) break;

        switch (part.type) {
          case 'text-delta':
            send({ t: 'text', v: part.text });
            break;
          case 'tool-call':
            this.logger.debug(`[${chatDto.chatId}] tool ${part.toolName}`);
            // `file-change` parts are adapter-level and never reach the agent
            // stream, so the target comes from the call's own arguments.
            send({
              t: 'tool',
              v: part.toolName,
              arg: targetOf(part.input),
            });
            break;
          case 'error':
            this.logger.error(`[${chatDto.chatId}] ${JSON.stringify(part)}`);
            send({ t: 'error', v: 'The agent hit an error and stopped.' });
            break;
        }
      }
    } catch (error) {
      this.logger.error(`[${chatDto.chatId}] ${error.message}`, error.stack);
      if (!res.writableEnded) send({ t: 'error', v: 'The agent turn failed.' });
    } finally {
      res.end();
      // Frees the bridge and its port. The project directory is the user's,
      // so the session is stopped rather than destroyed.
      await session.stop?.().catch?.(() => {});
    }
  }

  /**
   * Same newline-delimited JSON protocol as `pipeAgent`. It used to write the
   * raw text stream instead, which the client — a JSON-per-line parser —
   * dropped line by line, so a chat with no project answered with silence.
   */
  private async pipePlainCompletion(chatDto: ChatRestDto, res: Response) {
    const result = streamText({
      model: openrouter(chatDto.model || DEFAULT_MODEL),
      prompt: chatDto.message,
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
    } catch (error) {
      this.logger.error(`[${chatDto.chatId}] ${error.message}`, error.stack);
      if (!res.writableEnded) {
        res.write(
          `${JSON.stringify({ t: 'error', v: 'The reply failed.' })}\n`,
        );
      }
    } finally {
      res.end();
    }
  }
}
