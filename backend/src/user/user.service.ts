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
import { validateAndBufferFile } from 'src/common/security/file_check';
import { GitHubService } from 'src/github/github.service';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private readonly uploadService: UploadService,
    private readonly gitHubService: GitHubService,
  ) {}

  // Method to get all chats of a user
  async getUserChats(userId: string): Promise<User | null> {
    const user = await this.userRepository.findOne({
      where: { id: userId, isDeleted: false },
      relations: ['chats'], // Load 'chats' relation, even though it's lazy
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

    // Update the user's avatar URL
    user.avatarUrl = result.url;
    return this.userRepository.save(user);
  }

  async bindUserIdAndInstallId(
    userId: string,
    installationId: string,
    githubCode: string,
  ): Promise<boolean> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.githubInstallationId) {
      throw new BadRequestException(
        'User already linked to a GitHub installation.',
      );
    }

    if (!githubCode) {
      throw new BadRequestException('Missing GitHub OAuth code');
    }

    console.log(
      `Binding GitHub installation ID ${installationId} to user code ${githubCode}`,
    );

    //First request to GitHub to exchange the code for an access token (Wont expire)
    const accessToken =
      await this.gitHubService.exchangeOAuthCodeForToken(githubCode);

    user.githubInstallationId = installationId;
    user.githubAccessToken = accessToken;

    try {
      await this.userRepository.save(user);
    } catch (error) {
      console.error('Error saving user:', error);
      throw new Error('Failed to save user with installation ID');
    }

    return true;
  }
}
