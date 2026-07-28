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
import { ROLES_KEY } from 'src/common/decorators/roles.decorator';
import { User } from 'src/user/user.model';
import { Repository } from 'typeorm';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(
    private reflector: Reflector,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) {
      return true;
    }

    const gqlContext = GqlExecutionContext.create(context);
    const { req } = gqlContext.getContext();

    // JWTAuthGuard stores the token payload, which names the subject `userId`.
    // Reading `id` found nothing, so this guard rejected every caller — the
    // role system has never actually let anyone through.
    const userId = req.user?.userId ?? req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('User is not authenticated');
    }

    try {
      const user = await this.userRepository.findOne({
        where: { id: userId },
        relations: ['roles'],
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      const hasRole = user.roles.some((role) =>
        requiredRoles.includes(role.name),
      );

      if (!hasRole) {
        this.logger.warn(
          `User ${user.username} attempted to access resource without required roles: ${requiredRoles.join(', ')}`,
        );
        throw new UnauthorizedException('User does not have required roles');
      }

      return true;
    } catch (error) {
      this.logger.error(`Role check failed: ${error.message}`);
      throw error;
    }
  }
}
