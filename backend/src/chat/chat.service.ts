import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ChatCompletionChunk, Chat } from './chat.model';
import { MessageRole } from 'src/chat/message.model';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/user/user.model';
import {
  ChatInput,
  NewChatInput,
  UpdateChatTitleInput,
} from 'src/chat/dto/chat.input';
import { CustomAsyncIterableIterator } from 'src/common/model-provider/types';
import { OpenAIModelProvider } from 'src/common/model-provider/openai-model-provider';
import { Project } from 'src/project/project.model';

@Injectable()
export class ChatProxyService {
  private readonly logger = new Logger('ChatProxyService');
  private readonly models: OpenAIModelProvider =
    OpenAIModelProvider.getInstance();

  constructor() {}

  streamChat(
    input: ChatInput,
  ): CustomAsyncIterableIterator<ChatCompletionChunk> {
    return this.models.chat(
      {
        messages: [{ role: MessageRole.User, content: input.message }],
        model: input.model,
      },
      input.model,
    );
  }

  async chatSync(input: ChatInput): Promise<string> {
    return await this.models.chatSync({
      messages: [{ role: MessageRole.User, content: input.message }],
      model: input.model,
    });
  }

  async fetchModelTags(): Promise<string[]> {
    return await this.models.fetchModelsName();
  }
}

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Chat)
    private chatRepository: Repository<Chat>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async getChatHistory(chatId: string) {
    const chat = await this.chatRepository.findOne({
      where: { id: chatId, isDeleted: false },
    });
    Logger.log(chat);

    if (chat && chat.messages) {
      // Sort messages by createdAt in ascending order
      chat.messages = chat.messages
        .filter((message) => !message.isDeleted)
        .map((message) => {
          if (!(message.createdAt instanceof Date)) {
            message.createdAt = new Date(message.createdAt);
          }
          return message;
        })
        .sort((a, b) => {
          return a.createdAt.getTime() - b.createdAt.getTime();
        });
    }

    return chat ? chat.messages : [];
  }

  async getChatDetails(chatId: string): Promise<Chat> {
    const chat = await this.chatRepository.findOne({
      where: { id: chatId, isDeleted: false },
      relations: ['project'],
    });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    try {
      const messages = chat.messages || [];
      chat.messages = messages.filter((message: any) => !message.isDeleted);
    } catch (error) {
      console.error('Error parsing messages JSON:', error);
      chat.messages = [];
    }

    return chat;
  }

  async getProjectByChatId(chatId: string): Promise<Project> {
    const chat = await this.chatRepository.findOne({
      where: { id: chatId, isDeleted: false },
      relations: ['project'],
    });

    return chat ? chat.project : null;
  }

  async createChat(userId: string, newChatInput: NewChatInput): Promise<Chat> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    const newChat = this.chatRepository.create({
      title: newChatInput.title,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      user: user,
    });

    return await this.chatRepository.save(newChat);
  }

  async createChatWithMessage(
    userId: string,
    newChatInput: { title: string; message: string },
  ): Promise<Chat> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    // Create a new chat with the initial message
    const newChat = this.chatRepository.create({
      title: newChatInput.title,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      user: user,
    });

    // Save the chat first to get an ID
    const savedChat = await this.chatRepository.save(newChat);

    // Create the message with the chat's ID as a prefix
    const message = {
      id: `${savedChat.id}/0`,
      content: newChatInput.message,
      role: MessageRole.User,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      isDeleted: false,
    };

    // Update the chat with the message
    savedChat.messages = [message];
    return await this.chatRepository.save(savedChat);
  }

  async deleteChat(chatId: string): Promise<boolean> {
    const chat = await this.chatRepository.findOne({
      where: { id: chatId, isDeleted: false },
    });

    if (chat) {
      chat.isDeleted = true;
      chat.isActive = false;
      await this.chatRepository.save(chat);
      return true;
    }
    return false;
  }

  async clearChatHistory(chatId: string): Promise<boolean> {
    const chat = await this.chatRepository.findOne({
      where: { id: chatId, isDeleted: false },
    });
    if (chat) {
      chat.messages = [];
      chat.updatedAt = new Date();
      await this.chatRepository.save(chat);
      return true;
    }
    return false;
  }

  async updateChatTitle(
    updateChatTitleInput: UpdateChatTitleInput,
  ): Promise<Chat> {
    const chat = await this.chatRepository.findOne({
      where: { id: updateChatTitleInput.chatId, isDeleted: false },
    });
    new Logger('chat').log('chat', chat);
    if (chat) {
      chat.title = updateChatTitleInput.title;
      chat.updatedAt = new Date();
      return await this.chatRepository.save(chat);
    }
    return null;
  }

  async saveMessage(chatId: string, messageContent: string, role: MessageRole) {
    const chat = await this.chatRepository.findOne({ where: { id: chatId } });
    if (!chat) {
      return null;
    }

    if (!chat.messages) {
      chat.messages = [];
    }

    // Create new message with the chat's ID as a prefix
    const message = {
      id: `${chat.id}/${chat.messages.length}`,
      content: messageContent,
      role: role,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      isDeleted: false,
    };

    chat.messages.push(message);
    await this.chatRepository.save(chat);
    return message;
  }

  async getChatWithUser(chatId: string): Promise<Chat | null> {
    return this.chatRepository.findOne({
      where: { id: chatId, isDeleted: false },
      relations: ['user'],
    });
  }
}
