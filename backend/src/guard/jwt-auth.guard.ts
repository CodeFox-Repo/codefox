import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
  ContextType,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { JwtService } from '@nestjs/jwt';
import { JwtCacheService } from 'src/jwt-cache/jwt-cache.service';

@Injectable()
export class JWTAuthGuard implements CanActivate {
  private readonly logger = new Logger(JWTAuthGuard.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly jwtCacheService: JwtCacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    this.logger.debug('Starting JWT authentication process');

    let request;
    const contextType = context.getType();
    this.logger.debug(`Context Type: ${contextType}`);

    if (contextType === 'http') {
      request = context.switchToHttp().getRequest();
      this.logger.debug(
        `HTTP Request Headers: ${JSON.stringify(request.headers)}`,
      );
    } else if (contextType === ('graphql' as ContextType)) {
      // GraphQL API
      const gqlContext = GqlExecutionContext.create(context);
      const { req } = gqlContext.getContext();
      request = req;
      this.logger.debug('GraphQL request detected');
    }

    try {
      const token = this.extractTokenFromHeader(request);
      this.logger.debug(`Extracted Token: ${token}`);

      const payload = await this.verifyToken(token);
      this.logger.debug(`Token Verified. Payload: ${JSON.stringify(payload)}`);

      const isTokenValid = await this.jwtCacheService.isTokenStored(token);
      this.logger.debug(`Token stored in cache: ${isTokenValid}`);

      if (!isTokenValid) {
        this.logger.warn('Token has been invalidated');
        throw new UnauthorizedException('Token has been invalidated');
      }

      request.user = payload;
      this.logger.debug('User successfully authenticated');
      if (contextType === ('graphql' as ContextType)) {
        const gqlContext = GqlExecutionContext.create(context);
        gqlContext.getContext().user = payload;
      }
      return true;
    } catch (error) {
      this.logger.error(`Authentication failed: ${error.message}`);

      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Invalid authentication token');
    }
  }

  private extractTokenFromHeader(req: any): string {
    const authHeader = req.headers.authorization;
    this.logger.debug(`Authorization Header: ${authHeader}`);

    if (!authHeader) {
      this.logger.warn('Authorization header is missing');
      throw new UnauthorizedException('Authorization header is missing');
    }

    const [type, token] = authHeader.split(' ');

    if (type !== 'Bearer') {
      this.logger.warn('Invalid authorization header format');
      throw new UnauthorizedException('Invalid authorization header format');
    }

    if (!token) {
      this.logger.warn('Token is missing');
      throw new UnauthorizedException('Token is missing');
    }

    return token;
  }

  private async verifyToken(token: string): Promise<any> {
    try {
      this.logger.debug(`Verifying Token: ${token}`);
      return await this.jwtService.verifyAsync(token);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        this.logger.warn('Token has expired');
        throw new UnauthorizedException('Token has expired');
      }
      if (error.name === 'JsonWebTokenError') {
        this.logger.warn('Invalid token');
        throw new UnauthorizedException('Invalid token');
      }
      this.logger.error(`Token verification failed: ${error.message}`);
      throw error;
    }
  }
}
