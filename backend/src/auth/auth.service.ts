import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { AppConfigService } from 'src/config/config.service';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { LoginUserInput } from 'src/user/dto/login-user.input';
import { RegisterUserInput } from 'src/user/dto/register-user.input';
import { User } from 'src/user/user.model';
import { In, Repository } from 'typeorm';
import { CheckTokenInput } from './dto/check-token.input';
import { JwtCacheService } from 'src/jwt-cache/jwt-cache.service';
import { Menu } from './menu.model';
import { Role } from './role.model';
import { RefreshToken } from './refresh-token.model';
import { randomUUID } from 'crypto';
import { compare, hash } from 'bcrypt';
import {
  EmailConfirmationResponse,
  RefreshTokenResponse,
} from './auth.resolver';
import { MailService } from 'src/mail/mail.service';
import { findUserByEmail } from './find-by-email';
import {
  parseResetToken,
  signResetToken,
  verifyResetToken,
} from './reset-token';

@Injectable()
export class AuthService {
  private readonly isMailEnabled: boolean;

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
    private jwtCacheService: JwtCacheService,
    private configService: AppConfigService,
    private mailService: MailService,
    @InjectRepository(Menu)
    private menuRepository: Repository<Menu>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>,
  ) {
    this.isMailEnabled = this.configService.isMailEnabled;
  }

  async confirmEmail(token: string): Promise<EmailConfirmationResponse> {
    try {
      const payload = await this.jwtService.verifyAsync(token);

      // Check if payload has the required email field
      if (!payload || !payload.email) {
        return {
          message: 'Invalid token format',
          success: false,
        };
      }

      // Find user and update
      const user = await findUserByEmail(this.userRepository, payload.email);

      if (user && !user.isEmailConfirmed) {
        user.isEmailConfirmed = true;
        await this.userRepository.save(user);

        return {
          message: 'Email confirmed successfully!',
          success: true,
        };
      }

      return {
        message: 'Email already confirmed or user not found.',
        success: false,
      };
    } catch (error) {
      return {
        message: 'Invalid or expired token',
        success: false,
      };
    }
  }

  /**
   * Sign an account out everywhere, right now. Returns how many access
   * tokens were killed.
   *
   * Both halves matter and neither is enough alone: the refresh tokens are
   * what would mint a fresh session for up to 7 days, and the cached access
   * tokens are what still work for up to 30 minutes. Anything that decides an
   * account's sessions must end calls this rather than one of the two —
   * password reset used to drop refresh tokens only, and admin deactivation
   * dropped neither.
   */
  async endAllSessions(userId: string): Promise<number> {
    await this.refreshTokenRepository.delete({ userId });
    return this.jwtCacheService.removeTokensForUser(userId);
  }

  /** Whether this account signs in with a password (Google accounts do not). */
  async hasPassword(userId: string): Promise<boolean> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    return Boolean(user?.password);
  }

  /**
   * Change your own password, while signed in.
   *
   * The current password is required even though the caller already holds a
   * valid token: a stolen session must not become a stolen account. That is
   * the whole reason this is not just `resetPassword` with a guard.
   *
   * Every other session dies (endAllSessions), and this device gets a fresh
   * pair back — signing the user out of the tab they are standing in, to
   * punish them for good security hygiene, is not a thing worth building.
   *
   * ponytail: no rate limit. It costs one bcrypt compare and needs a valid
   * session plus the current password, so there is nothing here to guess at
   * that the login path does not already gate.
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<RefreshTokenResponse> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('No such user');
    // Google accounts have no password to verify against, so there is no
    // honest way to authorise the change. The UI hides the form for these.
    if (!user.password) {
      throw new BadRequestException(
        'This account signs in with Google and has no password to change.',
      );
    }
    if (!(await compare(currentPassword ?? '', user.password))) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters.');
    }

    user.password = await hash(newPassword, 10);
    await this.userRepository.save(user);

    // Same reason as a reset: the point of changing a password is usually
    // that someone else might have the old one.
    await this.endAllSessions(userId);

    // Then re-admit this device only.
    const accessToken = this.jwtService.sign(
      { userId: user.id, email: user.email },
      { expiresIn: '30m' },
    );
    const refreshTokenEntity = await this.createRefreshToken(user);
    this.jwtCacheService.storeAccessToken(accessToken, user.id);

    return { accessToken, refreshToken: refreshTokenEntity.token };
  }

  /**
   * Start a password reset. Always answers the same thing.
   *
   * The response cannot depend on whether the address has an account, or on
   * how long the work took — either one turns this into an oracle for
   * "is X registered here". So an unknown address, a Google-only account and
   * a real account all get the identical message, and the only thing that
   * varies is whether an email actually goes out.
   */
  async requestPasswordReset(
    email: string,
  ): Promise<EmailConfirmationResponse> {
    const same = {
      message:
        'If that address has an account, a reset link is on its way. Check your inbox.',
      success: true,
    };

    const user = await findUserByEmail(this.userRepository, email);
    // No account, or a Google sign-in with no password to reset.
    if (!user || !user.password) return same;

    // Same cooldown the resend path uses, and the same column. Without it
    // this endpoint is an unauthenticated way to send mail to any address.
    const cooldown = 60 * 1000;
    if (
      user.lastEmailSendTime &&
      Date.now() - user.lastEmailSendTime.getTime() < cooldown
    ) {
      return same;
    }

    const token = signResetToken(
      this.configService.jwtSecret,
      user.id,
      user.password,
    );

    user.lastEmailSendTime = new Date();
    await this.userRepository.save(user);

    if (this.isMailEnabled) {
      await this.mailService.sendPasswordResetEmail(user, token);
    } else {
      // SMTP is off in every environment today, so without this the feature
      // could not be exercised at all. The link is the whole secret, so it
      // goes to the server log and nowhere near the response.
      Logger.warn(
        `[auth] mail disabled — reset link for ${user.email}: ` +
          `${this.configService.frontendUrl}/reset-password?token=${token}`,
      );
    }

    return same;
  }

  /**
   * Finish a reset.
   *
   * Single use falls out of how the token is signed: the key includes the
   * current password hash, so the moment this saves a new one every link
   * issued against the old password stops verifying. Nothing to store, and
   * nothing to clean up.
   */
  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<EmailConfirmationResponse> {
    const bad = {
      message: 'This reset link is invalid or has expired. Request a new one.',
      success: false,
    };

    const parsed = parseResetToken(token);
    if (!parsed) return bad;

    const user = await this.userRepository.findOne({
      where: { id: parsed.userId },
    });
    if (!user || !user.password) return bad;
    if (!verifyResetToken(this.configService.jwtSecret, token, user.password)) {
      return bad;
    }

    // Validated here rather than in the DTO: the same rule has to hold for a
    // reset as for a registration, and the DTO for this mutation is two
    // strings.
    if (!newPassword || newPassword.length < 8) {
      return {
        message: 'Password must be at least 8 characters.',
        success: false,
      };
    }

    user.password = await hash(newPassword, 10);
    // Whoever is resetting may be locked out precisely because someone else
    // is in the account. Existing sessions must not survive it.
    await this.endAllSessions(user.id);
    // A reset proves control of the inbox, which is what confirmation asks.
    user.isEmailConfirmed = true;
    await this.userRepository.save(user);

    return { message: 'Password updated. You can sign in now.', success: true };
  }

  async sendVerificationEmail(user: User): Promise<EmailConfirmationResponse> {
    // Generate confirmation token
    const verifyToken = this.jwtService.sign(
      { email: user.email },
      { expiresIn: '30m' },
    );

    // Send confirmation email
    await this.mailService.sendConfirmationEmail(user.email, verifyToken);

    // update user last time send email time
    user.lastEmailSendTime = new Date();
    await this.userRepository.save(user);

    return {
      message: 'Verification email sent successfully!',
      success: true,
    };
  }

  async resendVerificationEmail(email: string) {
    const user = await findUserByEmail(this.userRepository, email);

    if (!user) {
      throw new Error('User not found');
    }

    if (user.isEmailConfirmed) {
      return { message: 'Email already confirmed!' };
    }

    // Check if a cooldown period has passed (e.g., 1 minute)
    const cooldownPeriod = 1 * 60 * 1000; // 1 minute in milliseconds
    if (
      user.lastEmailSendTime &&
      new Date().getTime() - user.lastEmailSendTime.getTime() < cooldownPeriod
    ) {
      const timeLeft = Math.ceil(
        (cooldownPeriod -
          (new Date().getTime() - user.lastEmailSendTime.getTime())) /
          1000,
      );
      return {
        message: `Please wait ${timeLeft} seconds before requesting another email`,
        success: false,
      };
    }

    return this.sendVerificationEmail(user);
  }

  /**
   * Open in development, closed in production unless explicitly opened.
   *
   * A prompt is untrusted input and the default sandbox is a scoped working
   * directory rather than isolation, so an open sign-up on a shared host
   * hands the server to whoever registers. Keep this closed until the agent
   * runs somewhere isolated (SANDBOX_PROVIDER=vercel).
   */
  get isRegistrationOpen(): boolean {
    const flag = process.env.ALLOW_REGISTRATION;
    if (flag != null) return flag === 'true';
    return !['production', 'PROD'].includes(process.env.NODE_ENV ?? '');
  }

  async register(registerUserInput: RegisterUserInput): Promise<User> {
    if (!this.isRegistrationOpen) {
      throw new ForbiddenException(
        'Sign-up is closed on this deployment. Ask the operator for an account.',
      );
    }

    const { username, password, confirmPassword } = registerUserInput;
    // Stored normalised so new rows are consistent. Lookups compare with
    // LOWER on both sides anyway, so the mixed-case rows already in the
    // database keep working — this only stops new ones appearing.
    const email = registerUserInput.email?.trim().toLowerCase();

    // Check for existing email
    const existingUser = await findUserByEmail(this.userRepository, email);

    if (password !== confirmPassword) {
      throw new ConflictException('Passwords do not match');
    }

    const hashedPassword = await hash(password, 10);

    // If the user exists but email is not confirmed and mail is enabled
    if (existingUser && !existingUser.isEmailConfirmed && this.isMailEnabled) {
      // Just update the existing user and resend verification email
      existingUser.username = username;
      existingUser.password = hashedPassword;
      await this.userRepository.save(existingUser);
      await this.sendVerificationEmail(existingUser);
      return existingUser;
    } else if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    let newUser;
    if (this.isMailEnabled) {
      newUser = this.userRepository.create({
        username,
        email,
        password: hashedPassword,
        isEmailConfirmed: false,
      });
    } else {
      newUser = this.userRepository.create({
        username,
        email,
        password: hashedPassword,
        isEmailConfirmed: true,
      });
    }

    try {
      await this.userRepository.save(newUser);
    } catch (error) {
      // The existence check above and this insert are separated by a bcrypt
      // hash, so two signups for one address can both pass the check. The
      // unique index is what actually stops the second — both now normalise
      // to the same lowercase string, so it fires — but a raw constraint
      // error surfaces as a 500. Say the same thing the check would have.
      if (/unique|constraint/i.test(String((error as Error)?.message))) {
        throw new ConflictException('Email already exists');
      }
      throw error;
    }

    if (this.isMailEnabled) {
      await this.sendVerificationEmail(newUser);
    }

    return newUser;
  }

  async login(loginUserInput: LoginUserInput): Promise<RefreshTokenResponse> {
    const { email, password } = loginUserInput;

    const user = await findUserByEmail(this.userRepository, email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Nothing read this flag, so disabling an account changed a column and
    // otherwise did nothing — the account kept signing in. Deliberately the
    // same message as a bad password: whether an account exists and has been
    // suspended is not something an unauthenticated caller should learn.
    if (!user.isActive || user.isDeleted) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isEmailConfirmed && this.isMailEnabled) {
      throw new Error('Email not confirmed. Please check your inbox.');
    }

    const isPasswordValid = await compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = this.jwtService.sign(
      { userId: user.id, email: user.email },
      { expiresIn: '30m' },
    );

    const refreshTokenEntity = await this.createRefreshToken(user);
    this.jwtCacheService.storeAccessToken(accessToken, user.id);

    return {
      accessToken,
      refreshToken: refreshTokenEntity.token,
    };
  }

  private async createRefreshToken(user: User): Promise<RefreshToken> {
    const token = randomUUID();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;

    const refreshToken = this.refreshTokenRepository.create({
      user,
      token,
      expiresAt: new Date(Date.now() + sevenDays), // 7 days
    });

    await this.refreshTokenRepository.save(refreshToken);
    return refreshToken;
  }

  async validateToken(params: CheckTokenInput): Promise<boolean> {
    try {
      await this.jwtService.verifyAsync(params.token);
      return this.jwtCacheService.isTokenStored(params.token);
    } catch (error) {
      Logger.log(error);
      return false;
    }
  }

  async logout(token: string): Promise<boolean> {
    try {
      const payload = await this.jwtService.verifyAsync(token);

      // The guard admits a token only while the cache still holds it, so this
      // is what actually ends the session. Without it logging out changed
      // nothing at all: the access token kept working until it expired.
      await this.jwtCacheService.removeToken(token);

      // Refresh tokens are looked up by the user, not by the access token
      // handed to this method — those are different strings, so the old
      // `where: { token }` never matched one and every refresh token outlived
      // every logout, indefinitely.
      await this.refreshTokenRepository.delete({
        userId: payload.userId,
      });

      return true;
    } catch (error) {
      return false;
    }
  }

  async assignMenusToRole(roleId: string, menuIds: string[]): Promise<Role> {
    // Find the role with existing menus
    const role = await this.roleRepository.findOne({
      where: { id: roleId },
      relations: ['menus'],
    });

    if (!role) {
      throw new NotFoundException(`Role with ID "${roleId}" not found`);
    }

    // Find all menus
    const menus = await this.menuRepository.findByIds(menuIds);

    if (menus.length !== menuIds.length) {
      throw new NotFoundException('Some menus were not found');
    }

    if (!role.menus) {
      role.menus = [];
    }

    const newMenus = menus.filter(
      (menu) => !role.menus.some((existingMenu) => existingMenu.id === menu.id),
    );

    if (newMenus.length === 0) {
      throw new ConflictException(
        'All specified menus are already assigned to this role',
      );
    }

    role.menus.push(...newMenus);

    try {
      await this.roleRepository.save(role);
      Logger.log(
        `${newMenus.length} menus assigned to role ${role.name} successfully`,
      );

      return await this.roleRepository.findOne({
        where: { id: roleId },
        relations: ['menus'],
      });
    } catch (error) {
      Logger.error(`Failed to assign menus to role: ${error.message}`);
      throw error;
    }
  }

  async removeMenuFromRole(roleId: string, menuId: string): Promise<Role> {
    const role = await this.roleRepository.findOne({
      where: { id: roleId },
      relations: ['menus'],
    });

    if (!role) {
      throw new NotFoundException(`Role with ID "${roleId}" not found`);
    }

    const menuIndex = role.menus?.findIndex((menu) => menu.id === menuId);

    if (menuIndex === -1) {
      throw new NotFoundException(
        `Menu with ID "${menuId}" not found in role "${role.name}"`,
      );
    }

    role.menus.splice(menuIndex, 1);

    try {
      await this.roleRepository.save(role);
      Logger.log(`Menu removed from role ${role.name} successfully`);

      return await this.roleRepository.findOne({
        where: { id: roleId },
        relations: ['menus'],
      });
    } catch (error) {
      Logger.error(`Failed to remove menu from role: ${error.message}`);
      throw error;
    }
  }

  async assignRoles(userId: string, roleIds: string[]): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['roles'],
    });

    if (!user) {
      throw new NotFoundException(`User with ID "${userId}" not found`);
    }

    const roles = await this.roleRepository.findBy({ id: In(roleIds) });

    if (roles.length !== roleIds.length) {
      throw new NotFoundException('Some roles were not found');
    }

    if (!user.roles) {
      user.roles = [];
    }

    const newRoles = roles.filter(
      (role) => !user.roles.some((existingRole) => existingRole.id === role.id),
    );

    if (newRoles.length === 0) {
      throw new ConflictException(
        'All specified roles are already assigned to this user',
      );
    }

    user.roles.push(...newRoles);

    try {
      await this.userRepository.save(user);
      Logger.log(
        `${newRoles.length} roles assigned to user ${user.username} successfully`,
      );

      return await this.userRepository.findOne({
        where: { id: userId },
        relations: ['roles'],
      });
    } catch (error) {
      Logger.error(`Failed to assign roles to user: ${error.message}`);
      throw error;
    }
  }

  async removeRoleFromUser(userId: string, roleId: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['roles'],
    });

    if (!user) {
      throw new NotFoundException(`User with ID "${userId}" not found`);
    }

    const roleIndex = user.roles?.findIndex((role) => role.id === roleId);

    if (roleIndex === -1) {
      throw new NotFoundException(
        `Role with ID "${roleId}" not found in user's roles`,
      );
    }

    user.roles.splice(roleIndex, 1);

    try {
      await this.userRepository.save(user);
      Logger.log(`Role removed from user ${user.username} successfully`);

      return await this.userRepository.findOne({
        where: { id: userId },
        relations: ['roles'],
      });
    } catch (error) {
      Logger.error(`Failed to remove role from user: ${error.message}`);
      throw error;
    }
  }

  async getUserRolesAndMenus(userId: string): Promise<{
    roles: Role[];
    menus: Menu[];
  }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['roles', 'roles.menus'],
    });

    if (!user) {
      throw new NotFoundException(`User with ID "${userId}" not found`);
    }

    const userRoles = user.roles || [];

    // Get unique menus across all roles
    const userMenus = Array.from(
      new Map(
        userRoles
          .flatMap((role) => role.menus || [])
          .map((menu) => [menu.id, menu]),
      ).values(),
    );

    return {
      roles: userRoles,
      menus: userMenus,
    };
  }

  async getUserRoles(userId: string): Promise<{
    roles: Role[];
  }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['roles'],
    });

    if (!user) {
      throw new NotFoundException(`User with ID "${userId}" not found`);
    }

    return {
      roles: user.roles || [],
    };
  }

  async getUserMenus(userId: string): Promise<{
    menus: Menu[];
  }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['roles', 'roles.menus'],
    });

    if (!user) {
      throw new NotFoundException(`User with ID "${userId}" not found`);
    }

    const userMenus = Array.from(
      new Map(
        (user.roles || [])
          .flatMap((role) => role.menus || [])
          .map((menu) => [menu.id, menu]),
      ).values(),
    );

    return {
      menus: userMenus,
    };
  }

  /**
   * refresh access token base on refresh token.
   * @param refreshToken refresh token
   * @returns return new access token and refresh token
   */
  async refreshToken(refreshToken: string): Promise<RefreshTokenResponse> {
    const existingToken = await this.refreshTokenRepository.findOne({
      where: { token: refreshToken },
      relations: ['user'],
    });

    if (!existingToken || existingToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Login refuses a closed account; refresh did not, so a deactivated user
    // could keep minting access tokens for the refresh token's seven days.
    if (!existingToken.user?.isActive || existingToken.user.isDeleted) {
      // The refresh token is the thing that would keep working, so it goes.
      await this.refreshTokenRepository.delete({ token: refreshToken });
      throw new UnauthorizedException('This account is no longer active');
    }

    const accessToken = this.jwtService.sign(
      {
        userId: existingToken.user.id,
        email: existingToken.user.email,
      },
      { expiresIn: '30m' },
    );

    this.jwtCacheService.storeAccessToken(accessToken, existingToken.user.id);

    return {
      accessToken,
      refreshToken: refreshToken,
    };
  }

  /**
   * Handles the Google OAuth callback: find or create the user, then issue JWT(s).
   * @param googleProfile The user object attached by the GoogleStrategy validate() method.
   * @returns an object containing accessToken & refreshToken (if you use refresh tokens).
   */
  async handleGoogleCallback(googleProfile: {
    googleId: string;
    email: string;
    firstName?: string;
    lastName?: string;
  }): Promise<{ accessToken: string; refreshToken?: string }> {
    Logger.log(`handle Google Callback for email: ${googleProfile.email}`);

    // First, try to find user by googleId
    let user = await this.userRepository.findOne({
      where: { googleId: googleProfile.googleId },
    });

    if (!user) {
      // If not found by googleId, try to find by email
      user = await findUserByEmail(this.userRepository, googleProfile.email);

      if (user) {
        // If found by email but not googleId, update the user with googleId
        Logger.log(
          `Linking existing email account to Google: ${googleProfile.email}`,
        );
        user.googleId = googleProfile.googleId;
        user.isEmailConfirmed = true; // Ensure email is confirmed since Google verifies emails

        // Update name if it wasn't set before
        if (!user.username || user.username === user.email.split('@')[0]) {
          const fullName = [googleProfile.firstName, googleProfile.lastName]
            .filter(Boolean)
            .join(' ');
          if (fullName) {
            user.username = fullName;
          }
        }

        user = await this.userRepository.save(user);
      } else {
        // If user not found at all, create a new one
        Logger.log(
          `Creating new user from Google account: ${googleProfile.email}`,
        );
        const fullName = [googleProfile.firstName, googleProfile.lastName]
          .filter(Boolean)
          .join(' ');

        user = this.userRepository.create({
          googleId: googleProfile.googleId,
          email: googleProfile.email,
          username: fullName || googleProfile.email.split('@')[0],
          isEmailConfirmed: true, // Google has already verified the email
          password: null, // OAuth users don't need a password
        });

        user = await this.userRepository.save(user);
      }
    }

    // Generate tokens
    const accessToken = this.jwtService.sign(
      { userId: user.id, email: user.email },
      { expiresIn: '30m' },
    );

    const refreshTokenEntity = await this.createRefreshToken(user);
    this.jwtCacheService.storeAccessToken(accessToken, user.id);

    const refreshToken = refreshTokenEntity.token;

    return {
      accessToken,
      refreshToken,
    };
  }
}
