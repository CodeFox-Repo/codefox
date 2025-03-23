import {
  Args,
  Field,
  Mutation,
  ObjectType,
  Query,
  Resolver,
} from '@nestjs/graphql';
import { User } from './user.model';
import { UserService } from './user.service';
import { RegisterUserInput } from './dto/register-user.input';
import { LoginUserInput } from './dto/login-user.input';
import { AuthService } from 'src/auth/auth.service';
import {
  GetAuthToken,
  GetUserIdFromToken,
} from 'src/decorator/get-auth-token.decorator';
import { Logger } from '@nestjs/common';
import { EmailConfirmationResponse } from 'src/auth/auth.resolver';
import { ResendEmailInput } from './dto/resend-email.input';
import { FileUpload, GraphQLUpload } from 'graphql-upload-minimal';

@ObjectType()
class LoginResponse {
  @Field()
  accessToken: string;

  @Field()
  refreshToken: string;
}

@ObjectType()
class AvatarUploadResponse {
  @Field()
  success: boolean;

  @Field()
  avatarUrl: string;
}

@Resolver(() => User)
export class UserResolver {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,
  ) {}

  // @Mutation(() => EmailConfirmationResponse)
  // async resendConfirmationEmail(
  //   @Args('input') resendInput: ResendConfirmationInput,
  // ): Promise<EmailConfirmationResponse> {
  //   return this.authService.resendVerificationEmail(resendInput.email);
  // }

  @Mutation(() => EmailConfirmationResponse)
  async resendConfirmationEmail(
    @Args('input') input: ResendEmailInput,
  ): Promise<EmailConfirmationResponse> {
    return this.authService.resendVerificationEmail(input.email);
  }

  @Mutation(() => User)
  async registerUser(
    @Args('input') registerUserInput: RegisterUserInput,
  ): Promise<User> {
    if (registerUserInput.password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }

    return this.authService.register(registerUserInput);
  }

  @Mutation(() => LoginResponse)
  async login(
    @Args('input') loginUserInput: LoginUserInput,
  ): Promise<LoginResponse> {
    return this.authService.login(loginUserInput);
  }

  @Query(() => Boolean)
  async logout(@GetAuthToken() token: string): Promise<boolean> {
    return this.authService.logout(token);
  }

  @Query(() => User)
  async me(@GetUserIdFromToken() id: string): Promise<User> {
    Logger.log('me id:', id);
    return this.userService.getUser(id);
  }

  /**
   * Upload a new avatar for the authenticated user
   * Uses validateAndBufferFile to ensure the image meets requirements
   */
  @Mutation(() => AvatarUploadResponse)
  async uploadAvatar(
    @GetUserIdFromToken() userId: string,
    @Args('file', { type: () => GraphQLUpload }) file: Promise<FileUpload>,
  ): Promise<AvatarUploadResponse> {
    try {
      const updatedUser = await this.userService.updateAvatar(userId, file);
      return {
        success: true,
        avatarUrl: updatedUser.avatarUrl,
      };
    } catch (error) {
      // Log the error
      Logger.error(
        `Avatar upload failed: ${error.message}`,
        error.stack,
        'UserResolver',
      );

      // Rethrow the exception to be handled by the GraphQL error handler
      throw error;
    }
  }

  /**
   * Get the avatar URL for a user
   */
  @Query(() => String, { nullable: true })
  async getUserAvatar(@Args('userId') userId: string): Promise<string | null> {
    const user = await this.userService.getUser(userId);
    return user ? user.avatarUrl : null;
  }
}
