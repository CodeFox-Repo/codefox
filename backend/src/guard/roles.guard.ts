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
import { ROLES_KEY } from 'src/decorator/roles.decorator';
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

    if (!req.user?.userId) {
      this.logger.warn(req.user);
      throw new UnauthorizedException('User is not authenticated');
    }

    try {
      const user = await this.userRepository.findOne({
        where: { id: req.user.id },
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
