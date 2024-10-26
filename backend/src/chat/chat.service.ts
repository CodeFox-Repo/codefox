import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ChatCompletionChunk, Chat, Message } from './chat.model';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/user/user.model';
import { ChatMessageInput } from 'src/chat/dto/chat.input';

type CustomAsyncIterableIterator<T> = AsyncIterator<T> & {
  [Symbol.asyncIterator](): AsyncIterableIterator<T>;
};

@Injectable()
export class ChatProxyService {
  private readonly logger = new Logger('ChatProxyService');

  constructor(private httpService: HttpService) {}

  streamChat(input: string): CustomAsyncIterableIterator<ChatCompletionChunk> {
    this.logger.debug('request chat input: ' + input);

    let isDone = false;
    let responseSubscription: any;
    const chunkQueue: ChatCompletionChunk[] = [];
    let resolveNextChunk:
      | ((value: IteratorResult<ChatCompletionChunk>) => void)
      | null = null;

    const iterator: CustomAsyncIterableIterator<ChatCompletionChunk> = {
      next: () => {
        return new Promise<IteratorResult<ChatCompletionChunk>>((resolve) => {
          if (chunkQueue.length > 0) {
            resolve({ done: false, value: chunkQueue.shift()! });
          } else if (isDone) {
            resolve({ done: true, value: undefined });
          } else {
            resolveNextChunk = resolve;
          }
        });
      },
      return: () => {
        isDone = true;
        if (responseSubscription) {
          responseSubscription.unsubscribe();
        }
        return Promise.resolve({ done: true, value: undefined });
      },
      throw: (error) => {
        isDone = true;
        if (responseSubscription) {
          responseSubscription.unsubscribe();
        }
        return Promise.reject(error);
      },
      [Symbol.asyncIterator]() {
        return this;
      },
    };

    responseSubscription = this.httpService
      .post(
        'http://localhost:3001/chat/completion',
        { content: input },
        { responseType: 'stream' },
      )
      .subscribe({
        next: (response) => {
          let buffer = '';
          response.data.on('data', (chunk: Buffer) => {
            buffer += chunk.toString();
            let newlineIndex;
            while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
              const line = buffer.slice(0, newlineIndex).trim();
              buffer = buffer.slice(newlineIndex + 1);
              if (line.startsWith('data: ')) {
                const jsonStr = line.slice(6);
                if (jsonStr === '[DONE]') {
                  isDone = true;
                  if (resolveNextChunk) {
                    resolveNextChunk({ done: true, value: undefined });
                    resolveNextChunk = null;
                  }
                  return;
                }
                try {
                  const parsedChunk: ChatCompletionChunk = JSON.parse(jsonStr);
                  if (this.isValidChunk(parsedChunk)) {
                    if (resolveNextChunk) {
                      resolveNextChunk({ done: false, value: parsedChunk });
                      resolveNextChunk = null;
                    } else {
                      chunkQueue.push(parsedChunk);
                    }
                  } else {
                    this.logger.warn('Invalid chunk received:', parsedChunk);
                  }
                } catch (error) {
                  this.logger.error('Error parsing chunk:', error);
                }
              }
            }
          });
          response.data.on('end', () => {
            this.logger.debug('Stream ended');
            isDone = true;
            if (resolveNextChunk) {
              resolveNextChunk({ done: true, value: undefined });
              resolveNextChunk = null;
            }
          });
        },
        error: (error) => {
          this.logger.error('Error in stream:', error);
          if (resolveNextChunk) {
            resolveNextChunk({ done: true, value: undefined });
            resolveNextChunk = null;
          }
        },
      });

    return iterator;
  }

  private isValidChunk(chunk: any): chunk is ChatCompletionChunk {
    return (
      chunk &&
      typeof chunk.id === 'string' &&
      typeof chunk.object === 'string' &&
      typeof chunk.created === 'number' &&
      typeof chunk.model === 'string' &&
      Array.isArray(chunk.choices) &&
      chunk.choices.length > 0 &&
      typeof chunk.choices[0].index === 'number' &&
      chunk.choices[0].delta &&
      typeof chunk.choices[0].delta.content === 'string'
    );
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

  async getChatHistory(chatId: string): Promise<Message[]> {
    const chat = await this.chatRepository.findOne({
      where: { id: chatId },
      relations: ['messages'],
    });
    return chat ? chat.messages : [];
  }

  async getChatDetails(chatId: string): Promise<Chat> {
    return this.chatRepository.findOne({
      where: { id: chatId },
      relations: ['messages'],
    });
  }

  async createChat(chatMessageInput: ChatMessageInput): Promise<Chat> {
    const newChat = this.chatRepository.create({
      title: chatMessageInput.title,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return await this.chatRepository.save(newChat);
  }

  async deleteChat(chatId: string): Promise<boolean> {
    const result = await this.chatRepository.delete(chatId);
    return result.affected > 0;
  }

  async clearChatHistory(chatId: string): Promise<boolean> {
    const chat = await this.chatRepository.findOne({
      where: { id: chatId },
      relations: ['messages'],
    });
    if (chat) {
      chat.messages = [];
      chat.updatedAt = new Date();
      await this.chatRepository.save(chat);
      return true;
    }
    return false;
  }

  async updateChatTitle(chatId: string, title: string): Promise<Chat> {
    const chat = await this.chatRepository.findOne({ where: { id: chatId } });
    if (chat) {
      chat.title = title;
      chat.updatedAt = new Date();
      return await this.chatRepository.save(chat);
    }
    return null;
  }
}
