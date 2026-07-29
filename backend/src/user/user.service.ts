import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { User } from './user.model';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { FileUpload } from 'graphql-upload-minimal';
import { UploadService } from '../upload/upload.service';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { validateAndBufferFile } from 'src/common/security/file_check';
import { staleMediaPath } from 'src/project/media-file';
// import { GitHubService } from 'src/github/github.service';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private readonly uploadService: UploadService,
    // private readonly gitHubService: GitHubService,
  ) {}

  // Method to get all chats of a user
  async getUserChats(userId: string): Promise<User | null> {
    const user = await this.userRepository.findOne({
      where: { id: userId, isDeleted: false },
      // 'chats.project' rides along so the home cards can label each
      // project's kind without a per-card query.
      relations: ['chats', 'chats.project'],
    });

    if (user) {
      // Resolve the lazy-loaded 'chats' relation and filter out soft-deleted chats
      const chats = await user.chats;
      user.chats = chats.filter((chat) => !chat.isDeleted);
    }

    return user;
  }

  async getUser(id: string): Promise<User> | null {
    return await this.userRepository.findOneBy({
      id,
    });
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findOne({
      where: { email },
    });
  }

  async deleteUser(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['chats', 'projects'],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Hard delete the user (cascades will handle related entities)
    await this.userRepository.remove(user);
  }

  /**
   * Updates the user's avatar
   * @param userId User ID
   * @param file File upload
   * @returns Updated user object
   */
  async updateAvatar(userId: string, file: Promise<FileUpload>): Promise<User> {
    // Get the user
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) {
      throw new Error('User not found');
    }

    // Validate and convert file to buffer
    const uploadedFile = await file;
    const { buffer, mimetype } = await validateAndBufferFile(uploadedFile);

    // Upload the validated buffer to storage
    const result = await this.uploadService.upload(buffer, mimetype, 'avatars');

    // Drop the avatar this one replaces. The project cover already did this;
    // avatars did not, so every change left another PNG on the volume with
    // nothing left pointing at it.
    const previous = user.avatarUrl;
    if (previous && previous !== result.url) {
      // Same rule as project covers: never unlink a file another row still
      // points at, and never resolve outside the media directory.
      const users = await this.userRepository.count({
        where: { avatarUrl: previous },
      });
      const stale = staleMediaPath(previous, users);
      if (stale) await fs.unlink(stale).catch(() => undefined);
    }

    user.avatarUrl = result.url;
    return this.userRepository.save(user);
  }

  // async bindUserIdAndInstallId(
  //   userId: string,
  //   installationId: string,
  //   githubCode: string,
  // ): Promise<boolean> {
  //   const user = await this.userRepository.findOne({ where: { id: userId } });
  //   if (!user) {
  //     throw new NotFoundException('User not found');
  //   }

  //   if (user.githubInstallationId) {
  //     throw new BadRequestException(
  //       'User already linked to a GitHub installation.',
  //     );
  //   }

  //   if (!githubCode) {
  //     throw new BadRequestException('Missing GitHub OAuth code');
  //   }

  //   console.log(
  //     `Binding GitHub installation ID ${installationId} to user code ${githubCode}`,
  //   );

  //   //First request to GitHub to exchange the code for an access token (Wont expire)
  //   const accessToken =
  //     await this.gitHubService.exchangeOAuthCodeForToken(githubCode);

  //   user.githubInstallationId = installationId;
  //   user.githubAccessToken = accessToken;

  //   try {
  //     await this.userRepository.save(user);
  //   } catch (error) {
  //     console.error('Error saving user:', error);
  //     throw new Error('Failed to save user with installation ID');
  //   }

  //   return true;
  // }
}
