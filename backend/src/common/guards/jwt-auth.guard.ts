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
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/user/user.model';

@Injectable()
export class JWTAuthGuard implements CanActivate {
  private readonly logger = new Logger(JWTAuthGuard.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly jwtCacheService: JwtCacheService,
    // A primary-key read, next to the token-cache read this guard already
    // does. Worth it: without it "deactivate" is advice rather than a
    // control.
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    let request;
    const contextType = context.getType();

    if (contextType === 'http') {
      request = context.switchToHttp().getRequest();
    } else if (contextType === ('graphql' as ContextType)) {
      // GraphQL API
      const gqlContext = GqlExecutionContext.create(context);
      const { req } = gqlContext.getContext();
      request = req;
    }

    try {
      // Nothing here prints the token or the headers that carry it. It used to
      // log both, so every REST call — including each agent turn — wrote a
      // working bearer token into the deploy's logs.
      const token = this.extractTokenFromHeader(request);
      const payload = await this.verifyToken(token);
      const isTokenValid = await this.jwtCacheService.isTokenStored(token);

      if (!isTokenValid) {
        this.logger.warn('Token has been invalidated');
        throw new UnauthorizedException('Token has been invalidated');
      }

      // Login refuses a deactivated account, but a token issued before the
      // deactivation kept working — so banning someone did nothing until
      // their token expired, and refresh (which also did not check) would
      // hand them a fresh one for another seven days. The account's current
      // state has to be part of admitting the request, not only of issuing
      // the token.
      const active = await this.users.findOne({
        where: { id: payload.userId },
        select: { id: true, isActive: true, isDeleted: true },
      });
      if (!active || !active.isActive || active.isDeleted) {
        this.logger.warn(`Rejected a token for a closed account`);
        throw new UnauthorizedException('This account is no longer active');
      }

      request.user = payload;
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
