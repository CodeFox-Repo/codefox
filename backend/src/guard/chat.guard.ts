import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ContextType,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from '../chat/chat.service';

@Injectable()
export class ChatGuard implements CanActivate {
  constructor(
    private readonly chatService: ChatService, // Inject ChatService to fetch chat details
    private readonly jwtService: JwtService, // JWT Service to verify tokens
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Determine if this is a GraphQL or REST request
    const contextType = context.getType();
    let chatId: string;
    let user: any;

    if (contextType === 'http') {
      // REST request (only for chat stream endpoint)
      const request = context.switchToHttp().getRequest();
      user = request.user;
      chatId = request.body?.chatId;
    } else if (contextType === ('graphql' as ContextType)) {
      // GraphQL request (for all other chat operations)
      const gqlContext = GqlExecutionContext.create(context);
      const { req } = gqlContext.getContext();
      user = req.user;

      const args = gqlContext.getArgs();
      chatId =
        args.chatId || args.input?.chatId || args.updateChatTitleInput?.chatId;

      // Allow chat creation mutation which doesn't require a chatId
      const info = gqlContext.getInfo();
      if (info.operation.name.value === 'createChat') {
        return true;
      }
    }

    // Common validation for both REST and GraphQL
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Skip chat validation for operations that don't require a chatId
    if (!chatId) {
      return true;
    }

    // Verify chat ownership for both types of requests
    const chat = await this.chatService.getChatWithUser(chatId);
    if (!chat) {
      throw new UnauthorizedException('Chat not found');
    }

    if (chat.user.id !== user.userId) {
      throw new UnauthorizedException(
        'User is not authorized to access this chat',
      );
    }

    return true;
  }
}

@Injectable()
export class ChatSubscriptionGuard implements CanActivate {
  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const wsContext = context.switchToWs();
    const client = wsContext.getClient();
    const token = client.handshake?.auth?.token?.split(' ')[1];

    if (!token) {
      throw new UnauthorizedException('Authorization token is missing');
    }

    let user: any;
    try {
      user = this.jwtService.verify(token);
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }

    const data = wsContext.getData();
    const { chatId } = data;

    // Check if the user is part of the chat
    const chat = await this.chatService.getChatWithUser(chatId);
    if (!chat || !chat.user || chat.user.id !== user.userId) {
      throw new UnauthorizedException(
        'User is not authorized to access this chat',
      );
    }

    return true;
  }
}
