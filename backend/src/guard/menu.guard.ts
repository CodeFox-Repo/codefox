import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { InjectRepository } from '@nestjs/typeorm';
import { MENU_PATH_KEY } from 'src/decorator/menu.decorator';
import { User } from 'src/user/user.model';
import { Repository } from 'typeorm';

@Injectable()
export class MenuGuard implements CanActivate {
  private readonly logger = new Logger(MenuGuard.name);

  constructor(
    private reflector: Reflector,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPath = this.reflector.getAllAndOverride<string>(
      MENU_PATH_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPath) {
      return true;
    }

    const gqlContext = GqlExecutionContext.create(context);
    const { req } = gqlContext.getContext();

    if (!req.user?.userId) {
      throw new UnauthorizedException('User is not authenticated');
    }

    try {
      const user = await this.userRepository.findOne({
        where: { id: req.user.id },
        relations: ['roles', 'roles.menus'],
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Check if user has any role with the wildcard '*' permission
      const hasWildcardAccess = user.roles.some((role) =>
        role.menus?.some(
          (menu) => menu.path === '*' || menu.permission === '*',
        ),
      );

      if (hasWildcardAccess) {
        return true;
      }

      // Check specific menu permissions
      const hasMenuAccess = user.roles.some((role) =>
        role.menus?.some((menu) => menu.path === requiredPath),
      );

      if (!hasMenuAccess) {
        this.logger.warn(
          `User ${user.username} attempted to access menu path: ${requiredPath} without permission`,
        );
        throw new UnauthorizedException(
          'User does not have access to this menu',
        );
      }

      return true;
    } catch (error) {
      this.logger.error(`Menu access check failed: ${error.message}`);
      throw error;
    }
  }
}
