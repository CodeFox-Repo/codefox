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

  /** Stream the agent's assistant text; tool activity is logged, not sent. */
  private async pipeAgent(chatDto: ChatRestDto, res: Response) {
    const project = await this.chatService.getProjectByChatId(chatDto.chatId);
    const { result, session } = await runProjectAgent({
      projectPath: project.projectPath,
      message: chatDto.message,
    });

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');

    try {
      for await (const part of result.stream) {
        if (part.type === 'text-delta') {
          res.write(part.text);
        } else if (part.type === 'tool-call') {
          this.logger.debug(`[${chatDto.chatId}] tool ${part.toolName}`);
        } else if (part.type === 'error') {
          this.logger.error(`[${chatDto.chatId}] ${JSON.stringify(part)}`);
        }
      }
    } finally {
      res.end();
      // Frees the bridge and its port. The project directory is the user's,
      // so the session is stopped rather than destroyed.
      await session.stop?.().catch?.(() => {});
    }
  }

  private async pipePlainCompletion(chatDto: ChatRestDto, res: Response) {
    const result = streamText({
      model: openrouter(chatDto.model || DEFAULT_MODEL),
      messages: [{ role: 'user', content: chatDto.message }],
    });

    const streamResponse = result.toTextStreamResponse();
    streamResponse.headers.forEach((value: string, key: string) => {
      res.setHeader(key, value);
    });

    const reader = streamResponse.body!.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();
  }
}
