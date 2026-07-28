import { Resolver, Args, Query, Mutation } from '@nestjs/graphql';
import { Chat } from './chat.model';
import { ChatService } from './chat.service';
import { UserService } from 'src/user/user.service';
import { Message } from './message.model';
import {
  ChatInput,
  NewChatInput,
  UpdateChatTitleInput,
} from './dto/chat.input';
import { GetUserIdFromToken } from 'src/common/decorators/get-auth-token.decorator';
import { Logger } from '@nestjs/common';
import { JWTAuth } from 'src/common/decorators/jwt-auth.decorator';
import { AVAILABLE_MODELS } from 'src/common/constants/ai.constants';

@Resolver('Chat')
export class ChatResolver {
  private readonly logger = new Logger('ChatResolver');

  constructor(
    private chatService: ChatService,
    private userService: UserService,
  ) {}

  @Mutation(() => Boolean)
  @JWTAuth()
  async saveMessage(@Args('input') input: ChatInput): Promise<boolean> {
    try {
      await this.chatService.saveMessage(
        input.chatId,
        input.message,
        input.role,
      );
      return true;
    } catch (error) {
      this.logger.error('Error in saveMessage:', error);
      throw error;
    }
  }

  @Query(() => [String], { nullable: true })
  async getAvailableModelTags(): Promise<string[]> {
    try {
      this.logger.log('Loaded model tags:', AVAILABLE_MODELS);
      return AVAILABLE_MODELS;
    } catch (error) {
      throw new Error('Failed to fetch model tags');
    }
  }

  @Query(() => [Chat], { nullable: true })
  @JWTAuth()
  async getUserChats(@GetUserIdFromToken() userId: string): Promise<Chat[]> {
    const user = await this.userService.getUserChats(userId);

    return user ? user.chats : [];
  }
  // To do: message need a update resolver

  @JWTAuth()
  @Query(() => [Message])
  async getChatHistory(@Args('chatId') chatId: string): Promise<Message[]> {
    return this.chatService.getChatHistory(chatId);
  }

  @JWTAuth()
  @Query(() => Chat, { nullable: true })
  async getChatDetails(@Args('chatId') chatId: string): Promise<Chat> {
    return this.chatService.getChatDetails(chatId);
  }

  @Mutation(() => Chat)
  @JWTAuth()
  async createChat(
    @GetUserIdFromToken() userId: string,
    @Args('newChatInput') newChatInput: NewChatInput,
  ): Promise<Chat> {
    return this.chatService.createChat(userId, newChatInput);
  }

  @JWTAuth()
  @Mutation(() => Boolean)
  async deleteChat(@Args('chatId') chatId: string): Promise<boolean> {
    return this.chatService.deleteChat(chatId);
  }

  @JWTAuth()
  @Mutation(() => Boolean)
  async clearChatHistory(@Args('chatId') chatId: string): Promise<boolean> {
    return this.chatService.clearChatHistory(chatId);
  }

  @JWTAuth()
  @Mutation(() => Chat, { nullable: true })
  async updateChatTitle(
    @Args('updateChatTitleInput') updateChatTitleInput: UpdateChatTitleInput,
  ): Promise<Chat> {
    return this.chatService.updateChatTitle(updateChatTitleInput);
  }
}
