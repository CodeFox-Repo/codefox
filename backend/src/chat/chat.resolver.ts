import { Resolver, Subscription, Args, Query, Mutation } from '@nestjs/graphql';
import { Chat, ChatCompletionChunk, StreamStatus } from './chat.model';
import { ChatProxyService, ChatService } from './chat.service';
import { UserService } from 'src/user/user.service';
import { Message } from './message.model';
import {
  ChatInput,
  NewChatInput,
  UpdateChatTitleInput,
} from './dto/chat.input';
import { GetUserIdFromToken } from 'src/decorator/get-auth-token.decorator';
import { Inject, Logger } from '@nestjs/common';
import { JWTAuth } from 'src/decorator/jwt-auth.decorator';
import { PubSubEngine } from 'graphql-subscriptions';
import { Project } from 'src/project/project.model';
@Resolver('Chat')
export class ChatResolver {
  private readonly logger = new Logger('ChatResolver');

  constructor(
    private chatProxyService: ChatProxyService,
    private chatService: ChatService,
    private userService: UserService,
    @Inject('PUB_SUB') private pubSub: PubSubEngine,
  ) {}

  @Subscription(() => ChatCompletionChunk, {
    nullable: true,
    filter: (payload, variables) => {
      return payload.chatStream.chatId === variables.input.chatId;
    },
    resolve: (payload) => payload.chatStream,
  })
  async chatStream(@Args('input') input: ChatInput) {
    const asyncIterator = this.pubSub.asyncIterator(
      `chat_stream_${input.chatId}`,
    );
    return asyncIterator;
  }
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
  @Mutation(() => Boolean)
  @JWTAuth()
  async triggerChatStream(@Args('input') input: ChatInput): Promise<boolean> {
    try {
      const iterator = this.chatProxyService.streamChat(input);
      let accumulatedContent = '';

      try {
        for await (const chunk of iterator) {
          console.log('received chunk:', chunk);
          if (chunk) {
            const enhancedChunk = {
              ...chunk,
              chatId: input.chatId,
            };

            await this.pubSub.publish(`chat_stream_${input.chatId}`, {
              chatStream: enhancedChunk,
            });

            if (chunk.choices?.[0]?.delta?.content) {
              accumulatedContent += chunk.choices[0].delta.content;
            }
          }
        }
      } finally {
        const finalChunk = await iterator.return();
        console.log('finalChunk:', finalChunk);

        if (finalChunk.value?.status === StreamStatus.DONE) {
          await this.pubSub.publish(`chat_stream_${input.chatId}`, {
            chatStream: {
              ...finalChunk.value,
              chatId: input.chatId,
            },
          });
        }
      }

      return true;
    } catch (error) {
      this.logger.error('Error in triggerChatStream:', error);
      throw error;
    }
  }

  @Query(() => [String], { nullable: true })
  async getAvailableModelTags(): Promise<string[]> {
    try {
      const response = await this.chatProxyService.fetchModelTags();
      this.logger.log('Loaded model tags:', response);
      return response;
    } catch (error) {
      throw new Error('Failed to fetch model tags');
    }
  }

  @Query(() => [Chat], { nullable: true })
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

  @JWTAuth()
  @Query(() => Project, { nullable: true })
  async getCurProject(@Args('chatId') chatId: string): Promise<Project> {
    try {
      const response = await this.chatService.getProjectByChatId(chatId);
      this.logger.log('Loaded project:', response);
      return response;
    } catch (error) {
      this.logger.error('Failed to fetch project:', error);
      throw new Error('Failed to fetch project');
    }
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
