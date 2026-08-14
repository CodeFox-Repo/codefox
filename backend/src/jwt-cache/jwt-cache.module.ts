import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/user/user.model';
import { RefreshToken } from 'src/auth/refresh-token.model';
import { JwtCacheService } from './jwt-cache.service';

/**
 * What JWTAuthGuard needs, in one import.
 *
 * The guard reads the User row to refuse a token whose account has since been
 * closed. Registering that repository in each module that mounts the guard
 * would mean a new module compiles and then fails at boot — this module is
 * already imported everywhere the guard is used, so its dependencies travel
 * together.
 */
@Module({
  // RefreshToken: the service sweeps expired rows on its existing interval.
  imports: [TypeOrmModule.forFeature([User, RefreshToken])],
  exports: [JwtCacheService, TypeOrmModule],
  providers: [JwtCacheService],
})
export class JwtCacheModule {}
