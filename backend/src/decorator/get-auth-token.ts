import {
  createParamDecorator,
  ExecutionContext,
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
      throw new UnauthorizedException(
        'Authorization token is missing or invalid',
      );
    }

    const token = authHeader.split(' ')[1];
    const jwtService = new JwtService({});
    const decodedToken: any = jwtService.decode(token);

    if (!decodedToken || !decodedToken.userId) {
      throw new UnauthorizedException('Invalid token');
    }

    return decodedToken.userId;
  },
);
