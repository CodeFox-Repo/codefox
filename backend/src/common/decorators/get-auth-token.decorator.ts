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
    const jwtService = new JwtService({});
    const decodedToken: any = jwtService.decode(token);

    if (!decodedToken || !decodedToken.userId) {
      Logger.debug('invalid token, token:' + token);
      throw new UnauthorizedException('Invalid token, token:', token);
    }

    return decodedToken.userId;
  },
);
