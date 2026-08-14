import { Public } from 'src/common/decorators/public.decorator';
import {
  Args,
  Query,
  Resolver,
  Mutation,
  Field,
  ObjectType,
} from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CheckTokenInput } from './dto/check-token.input';
import { JWTAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { GetUserIdFromToken } from 'src/common/decorators/get-auth-token.decorator';

@ObjectType()
export class RefreshTokenResponse {
  @Field()
  accessToken: string;

  @Field()
  refreshToken: string;
}

@ObjectType()
export class EmailConfirmationResponse {
  @Field()
  message: string;

  @Field({ nullable: true })
  success?: boolean;
}

@Resolver()
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  /** Lets the UI hide sign-up rather than offer a button that must fail. */
  @Query(() => Boolean)
  @Public()
  registrationOpen(): boolean {
    return this.authService.isRegistrationOpen;
  }

  /**
   * Whether a new account must confirm its email before signing in. With mail
   * disabled the backend lets unverified accounts straight in — the sign-up
   * modal used to promise a verification email that was never sent.
   */
  @Query(() => Boolean)
  @Public()
  emailVerificationRequired(): boolean {
    return process.env.MAIL_ENABLED?.toLowerCase() === 'true';
  }

  /**
   * Whether "Continue with Google" can actually work. The strategy boots on
   * placeholder credentials when unconfigured, so the button used to send
   * users to a Google error page.
   */
  @Query(() => Boolean)
  @Public()
  googleAuthAvailable(): boolean {
    return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_SECRET);
  }

  @Query(() => Boolean)
  @Public()
  async checkToken(@Args('input') params: CheckTokenInput): Promise<boolean> {
    return this.authService.validateToken(params);
  }

  @Mutation(() => RefreshTokenResponse)
  @Public()
  async refreshToken(
    @Args('refreshToken') refreshToken: string,
  ): Promise<RefreshTokenResponse> {
    return this.authService.refreshToken(refreshToken);
  }

  @Mutation(() => EmailConfirmationResponse)
  @Public()
  async confirmEmail(
    @Args('token') token: string,
  ): Promise<EmailConfirmationResponse> {
    return this.authService.confirmEmail(token);
  }

  /**
   * Whether this account has a password at all.
   *
   * A Google sign-in has none, so the settings form would be a box whose only
   * possible outcome is an error. Same shape as `googleAuthAvailable` and
   * `registrationOpen`: the UI asks before it offers.
   *
   * A query rather than a field on `User`: field resolvers run unguarded, and
   * `User` is reachable from the public gallery.
   */
  @Query(() => Boolean)
  @UseGuards(JWTAuthGuard)
  async hasPassword(@GetUserIdFromToken() userId: string): Promise<boolean> {
    return this.authService.hasPassword(userId);
  }

  /**
   * Change your own password. Guarded AND re-checks the current password:
   * holding a session is not authorisation to take the account over.
   *
   * Returns a fresh token pair — the change ends every session including this
   * one, and the device doing it should not be signed out for its trouble.
   */
  @Mutation(() => RefreshTokenResponse)
  @UseGuards(JWTAuthGuard)
  async changePassword(
    @GetUserIdFromToken() userId: string,
    @Args('currentPassword') currentPassword: string,
    @Args('newPassword') newPassword: string,
  ): Promise<RefreshTokenResponse> {
    return this.authService.changePassword(userId, currentPassword, newPassword);
  }

  /**
   * Public by necessity — someone who has forgotten their password cannot be
   * holding a token. The service answers identically whether or not the
   * address is registered, so this is not an account oracle.
   */
  @Mutation(() => EmailConfirmationResponse)
  @Public()
  async requestPasswordReset(
    @Args('email') email: string,
  ): Promise<EmailConfirmationResponse> {
    return this.authService.requestPasswordReset(email);
  }

  @Mutation(() => EmailConfirmationResponse)
  @Public()
  async resetPassword(
    @Args('token') token: string,
    @Args('newPassword') newPassword: string,
  ): Promise<EmailConfirmationResponse> {
    return this.authService.resetPassword(token, newPassword);
  }
}
