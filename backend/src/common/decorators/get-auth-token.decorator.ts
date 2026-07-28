//this is parameter decorator to get the token from the request header
import {
  createParamDecorator,
  ExecutionContext,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { JwtService } from '@nestjs/jwt';

export const GetAuthToken = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const gqlContext = GqlExecutionContext.create(context);
    const request = gqlContext.getContext().req;
    const authHeader = request.headers.authorization;

    if (authHeader && authHeader.split(' ')[0] === 'Bearer') {
      return authHeader.split(' ')[1];
    }
    return null;
  },
);

export const GetUserIdFromToken = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      Logger.error('Authorization token is missing or invalid');
      throw new UnauthorizedException(
        'Authorization token is missing or invalid',
      );
    }

    const token = authHeader.split(' ')[1];

    // Verified, not merely decoded. `decode` reads the payload without ever
    // looking at the signature, so a handler that only used this decorator
    // — `me`, `uploadAvatar`, the project download — accepted any hand-written
    // token naming someone else's id and answered as that user.
    //
    // A param decorator has no injector, so the secret comes from the
    // environment; it is the same value AppConfigService hands JwtModule.
    let payload: any;
    try {
      payload = new JwtService({}).verify(token, {
        secret: process.env.JWT_SECRET,
      });
    } catch (error) {
      Logger.warn(`Rejected token: ${(error as Error).message}`);
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (!payload?.userId) {
      throw new UnauthorizedException('Token carries no user');
    }

    return payload.userId;
  },
);
