import { Controller, Post, Body, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ChatService } from './chat.service';
import { ChatRestDto } from './dto/chat-rest.dto';
import { MessageRole } from './message.model';
import { JWTAuthGuard } from '../guard/jwt-auth.guard';
import { ChatGuard } from '../guard/chat.guard';
import { GetAuthToken } from '../decorator/get-auth-token.decorator';
import { OpenAIModelProvider } from 'src/common/model-provider/openai-model-provider';

@Controller('api/chat')
@UseGuards(JWTAuthGuard, ChatGuard) // Order matters: JWTAuthGuard sets user object, then ChatGuard uses it
export class ChatController {
  private readonly modelProvider: OpenAIModelProvider =
    OpenAIModelProvider.getInstance();

  constructor(private readonly chatService: ChatService) {}

  @Post()
  async chat(
    @Body() chatDto: ChatRestDto,
    @Res() res: Response,
    @GetAuthToken() userId: string,
  ) {
    try {
      if (chatDto.stream) {
        // Streaming response
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const stream = this.modelProvider.chat(
          {
            messages: [{ role: MessageRole.User, content: chatDto.message }],
            model: chatDto.model,
          },
          chatDto.model,
        );

        let fullResponse = '';

        for await (const chunk of stream) {
          if (chunk.choices[0]?.delta?.content) {
            const content = chunk.choices[0].delta.content;
            fullResponse += content;
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
          }
        }

        res.write('data: [DONE]\n\n');
        res.end();
      } else {
        // Non-streaming response using chatSync
        const response = await this.modelProvider.chatSync({
          messages: [{ role: MessageRole.User, content: chatDto.message }],
          model: chatDto.model,
        });
        res.json({ content: response });
      }
    } catch (error) {
      console.error('Chat error:', error);
      res.status(500).json({
        error: 'An error occurred during chat processing',
      });
    }
  }
}
