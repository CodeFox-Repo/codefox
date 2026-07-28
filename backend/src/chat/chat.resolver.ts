import { Public } from 'src/common/decorators/public.decorator';
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
import { Logger, UseGuards } from '@nestjs/common';
import { JWTAuth } from 'src/common/decorators/jwt-auth.decorator';
import { JWTAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { ChatGuard } from 'src/common/guards/chat.guard';
import { AVAILABLE_MODELS } from 'src/common/constants/ai.constants';

@Resolver('Chat')
export class ChatResolver {
  private readonly logger = new Logger('ChatResolver');

  constructor(
    private chatService: ChatService,
    private userService: UserService,
  ) {}

  // JWTAuthGuard first — it puts the user on the request; ChatGuard then
  // refuses a chatId the caller does not own. Every chat-scoped operation
  // here carries both: with @JWTAuth() alone, any signed-in user could read,
  // rename, clear, delete or write into anyone else's chat by id.
  @Mutation(() => Boolean)
  @UseGuards(JWTAuthGuard, ChatGuard)
  async saveMessage(@Args('input') input: ChatInput): Promise<boolean> {
    try {
      await this.chatService.saveMessage(
        input.chatId,
        input.message,
        input.role,
        input.steps,
      );
      return true;
    } catch (error) {
      this.logger.error('Error in saveMessage:', error);
      throw error;
    }
  }

  @Query(() => [String], { nullable: true })
  @Public()
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

  @UseGuards(JWTAuthGuard, ChatGuard)
  @Query(() => [Message])
  async getChatHistory(@Args('chatId') chatId: string): Promise<Message[]> {
    return this.chatService.getChatHistory(chatId);
  }

  @UseGuards(JWTAuthGuard, ChatGuard)
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

  @UseGuards(JWTAuthGuard, ChatGuard)
  @Mutation(() => Boolean)
  async deleteChat(@Args('chatId') chatId: string): Promise<boolean> {
    return this.chatService.deleteChat(chatId);
  }

  @UseGuards(JWTAuthGuard, ChatGuard)
  @Mutation(() => Boolean)
  async clearChatHistory(@Args('chatId') chatId: string): Promise<boolean> {
    return this.chatService.clearChatHistory(chatId);
  }

  /** True when a trailing assistant reply existed and was dropped. */
  @UseGuards(JWTAuthGuard, ChatGuard)
  @Mutation(() => Boolean)
  async dropLastAssistantReply(
    @Args('chatId') chatId: string,
  ): Promise<boolean> {
    return this.chatService.dropLastAssistantReply(chatId);
  }

  @UseGuards(JWTAuthGuard, ChatGuard)
  @Mutation(() => Chat, { nullable: true })
  async updateChatModel(
    @Args('chatId') chatId: string,
    @Args('model') model: string,
  ): Promise<Chat | null> {
    // Only a model the endpoint actually serves; a typo here would silently
    // poison every later turn of the chat.
    if (!AVAILABLE_MODELS.includes(model)) {
      throw new Error(`Unknown model: ${model}`);
    }
    return this.chatService.updateChatModel(chatId, model);
  }

  @UseGuards(JWTAuthGuard, ChatGuard)
  @Mutation(() => Chat, { nullable: true })
  async updateChatTitle(
    @Args('updateChatTitleInput') updateChatTitleInput: UpdateChatTitleInput,
  ): Promise<Chat> {
    return this.chatService.updateChatTitle(updateChatTitleInput);
  }
}
