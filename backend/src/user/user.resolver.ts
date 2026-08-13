import { Public } from 'src/common/decorators/public.decorator';
import {
  Args,
  Field,
  Mutation,
  ObjectType,
  Parent,
  Query,
  ResolveField,
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
} from 'src/common/decorators/get-auth-token.decorator';
import { Logger, UseGuards } from '@nestjs/common';
import { JWTAuthGuard } from 'src/common/guards/jwt-auth.guard';
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
  @Public()
  async resendConfirmationEmail(
    @Args('input') input: ResendEmailInput,
  ): Promise<EmailConfirmationResponse> {
    return this.authService.resendVerificationEmail(input.email);
  }

  @Mutation(() => User)
  @Public()
  async registerUser(
    @Args('input') registerUserInput: RegisterUserInput,
  ): Promise<User> {
    if (registerUserInput.password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }

    return this.authService.register(registerUserInput);
  }

  @Mutation(() => LoginResponse)
  @Public()
  async login(
    @Args('input') loginUserInput: LoginUserInput,
  ): Promise<LoginResponse> {
    return this.authService.login(loginUserInput);
  }

  @Query(() => Boolean)
  async logout(@GetAuthToken() token: string): Promise<boolean> {
    return this.authService.logout(token);
  }

  // Guarded, not just decorated: the decorator proves the signature is ours,
  // while the guard is what rejects a token that logout has since retired.
  @Query(() => User)
  @UseGuards(JWTAuthGuard)
  async me(@GetUserIdFromToken() id: string): Promise<User> {
    Logger.log('me id:', id);
    return this.userService.getUser(id);
  }

  /**
   * Role names for the caller, so the client can offer the operator console to
   * the people who can actually open it. Names rather than the Role entity:
   * the GraphQL type `Role` is already the message-author enum.
   *
   * A top-level guarded query rather than a field on User. As a @ResolveField
   * it ran with no guard at all — APP_GUARD does not reach field resolvers
   * unless `fieldResolverEnhancers` is set, and it is not — so anonymous
   * callers could walk fetchPublicProjects (@Public) → Project.user → roles
   * and enumerate which accounts are admins. Asking only about the bearer
   * means there is no other user's roles to leak.
   */
  @Query(() => [String])
  @UseGuards(JWTAuthGuard)
  async myRoles(@GetUserIdFromToken() id: string): Promise<string[]> {
    const { roles } = await this.authService.getUserRoles(id);
    return roles.map((role) => role.name);
  }

  /** Rename yourself. The settings page called this "not editable yet". */
  @Mutation(() => User)
  @UseGuards(JWTAuthGuard)
  async updateUsername(
    @GetUserIdFromToken() userId: string,
    @Args('username') username: string,
  ): Promise<User> {
    return this.userService.updateUsername(userId, username);
  }

  /**
   * Upload a new avatar for the authenticated user
   * Uses validateAndBufferFile to ensure the image meets requirements
   */
  @Mutation(() => AvatarUploadResponse)
  @UseGuards(JWTAuthGuard)
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
}
