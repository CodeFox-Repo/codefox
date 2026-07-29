import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Chat } from './chat.model';
import { MessageRole, TurnStep } from 'src/chat/message.model';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/user/user.model';
import { NewChatInput, UpdateChatTitleInput } from 'src/chat/dto/chat.input';
import { Project } from 'src/project/project.model';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Chat)
    private chatRepository: Repository<Chat>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  /**
   * The tail of each chat's write queue.
   *
   * A chat's messages are one JSON column, so appending means read the array,
   * push, write the array back. Concurrent appends each read the same array
   * and the last write wins: six messages saved at once stored two, and the
   * other four were gone with every call having returned success. There is no
   * atomic append for a JSON column — the writes have to take turns.
   *
   * Static because the invariant is per chat, not per injected instance.
   */
  private static readonly writes = new Map<string, Promise<unknown>>();

  /** Run `write` after any write already queued for this chat. */
  private static serialise<T>(
    chatId: string,
    write: () => Promise<T>,
  ): Promise<T> {
    const ahead = ChatService.writes.get(chatId) ?? Promise.resolve();
    const mine = ahead.then(write, write);
    // The stored promise never rejects, so one failed write cannot wedge the
    // chat; the entry is dropped once the queue drains.
    const tail = mine.then(
      () => undefined,
      () => undefined,
    );
    ChatService.writes.set(chatId, tail);
    void tail.then(() => {
      if (ChatService.writes.get(chatId) === tail) {
        ChatService.writes.delete(chatId);
      }
    });
    return mine;
  }

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
    newChatInput: { title: string; message: string; model?: string },
  ): Promise<Chat> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    // Create a new chat with the initial message
    const newChat = this.chatRepository.create({
      title: newChatInput.title,
      model: newChatInput.model ?? null,
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
    // Queued with the appends: clearing does not read the array first, but an
    // append that started before the clear would write its stale copy back
    // afterwards and undo it.
    return ChatService.serialise(chatId, async () => {
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
    });
  }

  /**
   * Soft-delete the trailing assistant reply so a regenerate can replace it.
   * Only the tail: pruning an answer mid-history would silently rewrite the
   * conversation every later turn was built on.
   */
  async dropLastAssistantReply(chatId: string): Promise<boolean> {
    // Same column as saveMessage, so the same queue: dropping a reply while
    // one is being appended would otherwise write back an array that never
    // saw the append.
    return ChatService.serialise(chatId, async () => {
      const chat = await this.chatRepository.findOne({
        where: { id: chatId, isDeleted: false },
      });
      if (!chat?.messages?.length) return false;

      const live = chat.messages.filter((m) => !m.isDeleted);
      const last = live[live.length - 1];
      if (!last || String(last.role).toLowerCase() !== 'assistant') {
        return false;
      }

      last.isDeleted = true;
      last.updatedAt = new Date();
      await this.chatRepository.save(chat);
      return true;
    });
  }

  async updateChatModel(chatId: string, model: string): Promise<Chat | null> {
    // Loads the whole row, messages included, and saves it back — so without
    // the queue, changing the model mid-turn writes back an array that never
    // saw the turn's replies.
    return ChatService.serialise(chatId, async () => {
      const chat = await this.chatRepository.findOne({
        where: { id: chatId, isDeleted: false },
      });
      if (!chat) return null;
      chat.model = model;
      chat.updatedAt = new Date();
      return this.chatRepository.save(chat);
    });
  }

  async updateChatTitle(
    updateChatTitleInput: UpdateChatTitleInput,
  ): Promise<Chat> {
    // Queued for the same reason as updateChatModel: this saves the whole
    // row, so renaming a chat mid-turn would write back its messages as they
    // looked when this read them.
    return ChatService.serialise(updateChatTitleInput.chatId, async () => {
      const chat = await this.chatRepository.findOne({
        where: { id: updateChatTitleInput.chatId, isDeleted: false },
      });
      if (chat) {
        chat.title = updateChatTitleInput.title;
        chat.updatedAt = new Date();
        return await this.chatRepository.save(chat);
      }
      return null;
    });
  }


  async saveMessage(
    chatId: string,
    messageContent: string,
    role: MessageRole,
    steps?: TurnStep[],
  ) {
    // Queued: the whole read-push-write below has to be one turn, or a
    // concurrent append overwrites it. See ChatService.writes.
    return ChatService.serialise(chatId, async () => {
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
        ...(steps?.length ? { steps } : {}),
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
        isDeleted: false,
      };

      chat.messages.push(message);
      await this.chatRepository.save(chat);
      return message;
    });
  }

  async getChatWithUser(chatId: string): Promise<Chat | null> {
    return this.chatRepository.findOne({
      where: { id: chatId, isDeleted: false },
      relations: ['user'],
    });
  }
}
