import { forwardRef, Module } from '@nestjs/common';
import { JwtCacheModule } from 'src/jwt-cache/jwt-cache.module';
import { UserResolver } from './user.resolver';
import { UserService } from './user.service';
import { DateScalar } from 'src/common/scalar/date.scalar';
import { User } from './user.model';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from 'src/auth/auth.module';
import { MailModule } from 'src/mail/mail.module';
import { UploadModule } from 'src/upload/upload.module';
// import { GitHubModule } from 'src/github/github.module';
import { TestCleanupController } from './test-cleanup.controller';

import { AppConfigModule } from 'src/config/config.module';
/**
 * Same test as AppConfigService.isProduction, read here because a module's
 * controller list is decided before any provider exists.
 */
const isProduction = ['production', 'PROD'].includes(process.env.NODE_ENV ?? '');

@Module({
  imports: [
    // JWTAuthGuard needs it; `me` and `uploadAvatar` are guarded.
    JwtCacheModule,
    TypeOrmModule.forFeature([User]),
    JwtModule,
    AuthModule,
    MailModule,
    UploadModule,
    AppConfigModule,
    // forwardRef(() => GitHubModule),
  ],
  // An unauthenticated DELETE that removes an account by email. It guards
  // itself with a runtime environment check, which is one mistyped NODE_ENV
  // away from letting anyone delete anyone — and this repo has already been
  // bitten by a polluted NODE_ENV. Not registering it means production has no
  // such route to call at all; `backend/test/quick-test.sh` still gets it
  // locally.
  controllers: isProduction ? [] : [TestCleanupController],
  providers: [UserResolver, UserService, DateScalar],
  exports: [UserService],
})
export class UserModule {}
