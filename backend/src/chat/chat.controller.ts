import { Controller, Post, Body, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ChatService } from './chat.service';
import { ChatRestDto } from './dto/chat-rest.dto';
import { JWTAuthGuard } from '../common/guards/jwt-auth.guard';
import { ChatGuard } from '../common/guards/chat.guard';
import { GetAuthToken } from '../common/decorators/get-auth-token.decorator';
import { streamText } from 'ai';
import { openrouter, DEFAULT_MODEL } from '../common/constants/ai.constants';

@Controller('api/chat')
@UseGuards(JWTAuthGuard, ChatGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  async chat(
    @Body() chatDto: ChatRestDto,
    @Res() res: Response,
    @GetAuthToken() userId: string,
  ) {
    try {
      const result = streamText({
        model: openrouter(chatDto.model || DEFAULT_MODEL),
        messages: [{ role: 'user', content: chatDto.message }],
      });

      const streamResponse = result.toTextStreamResponse();

      streamResponse.headers.forEach((value: string, key: string) => {
        res.setHeader(key, value);
      });

      const reader = streamResponse.body!.getReader();
      const pump = async () => {
        const { done, value } = await reader.read();
        if (done) {
          res.end();
          return;
        }
        res.write(value);
        pump();
      };
      pump();
    } catch (error) {
      console.error('Chat error:', error);
      res.status(500).json({
        error: 'An error occurred during chat processing',
      });
    }
  }
}
