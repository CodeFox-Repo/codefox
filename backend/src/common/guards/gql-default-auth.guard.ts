import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { JWTAuthGuard } from './jwt-auth.guard';

/**
 * Default-deny for the GraphQL surface.
 *
 * Every resolver runs behind authentication unless it is explicitly marked
 * `@Public()`. This exists because the chat API shipped with six operations
 * that simply forgot their guard — anyone signed in could read or delete
 * anyone's chats. With this in place, a forgotten guard fails closed.
 *
 * REST requests pass through untouched: the controllers carry their own
 * guards, and several REST paths (health, the preview proxy's cookie flow)
 * are public on purpose.
 */
@Injectable()
export class GqlDefaultAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtAuthGuard: JWTAuthGuard,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== ('graphql' as ReturnType<typeof context.getType>))
      return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    return this.jwtAuthGuard.canActivate(context);
  }
}
