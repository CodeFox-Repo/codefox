import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
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
import { Menu } from './menu/menu.model';
import { Role } from './role/role.model';
import { RefreshToken } from './refresh-token/refresh-token.model';
import { randomUUID } from 'crypto';
import { compare, hash } from 'bcrypt';
import {
  EmailConfirmationResponse,
  RefreshTokenResponse,
} from './auth.resolver';
import { MailService } from 'src/mail/mail.service';

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
      const user = await this.userRepository.findOne({
        where: { email: payload.email },
      });

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
    const user = await this.userRepository.findOne({
      where: { email },
    });

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

  async register(registerUserInput: RegisterUserInput): Promise<User> {
    const { username, email, password, confirmPassword } = registerUserInput;

    // Check for existing email
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });

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

    await this.userRepository.save(newUser);

    if (this.isMailEnabled) {
      await this.sendVerificationEmail(newUser);
    }

    return newUser;
  }

  async login(loginUserInput: LoginUserInput): Promise<RefreshTokenResponse> {
    const { email, password } = loginUserInput;

    const user = await this.userRepository.findOne({
      where: { email },
    });

    if (!user) {
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
    this.jwtCacheService.storeAccessToken(accessToken);

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
      await this.jwtService.verifyAsync(token);
      const refreshToken = await this.refreshTokenRepository.findOne({
        where: { token },
      });

      if (refreshToken) {
        await this.refreshTokenRepository.remove(refreshToken);
      }

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

    const accessToken = this.jwtService.sign(
      {
        userId: existingToken.user.id,
        email: existingToken.user.email,
      },
      { expiresIn: '30m' },
    );

    this.jwtCacheService.storeAccessToken(accessToken);

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
      user = await this.userRepository.findOne({
        where: { email: googleProfile.email },
      });

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
    this.jwtCacheService.storeAccessToken(accessToken);

    const refreshToken = refreshTokenEntity.token;

    return {
      accessToken,
      refreshToken,
    };
  }
}
