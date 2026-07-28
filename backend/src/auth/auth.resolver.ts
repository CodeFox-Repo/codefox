import { Public } from 'src/common/decorators/public.decorator';
import {
  Args,
  Query,
  Resolver,
  Mutation,
  Field,
  ObjectType,
} from '@nestjs/graphql';
import { AuthService } from './auth.service';
import { CheckTokenInput } from './dto/check-token.input';

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
}
