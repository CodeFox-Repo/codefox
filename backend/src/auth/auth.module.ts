import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { GqlDefaultAuthGuard } from 'src/common/guards/gql-default-auth.guard';
import { JWTAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Menu } from './menu.model';
import { JwtModule } from '@nestjs/jwt';
import { Role } from './role.model';
import { AuthService } from './auth.service';
import { User } from 'src/user/user.model';
import { AppConfigService } from 'src/config/config.service';
import { AuthResolver } from './auth.resolver';
import { RefreshToken } from './refresh-token.model';
import { JwtCacheModule } from 'src/jwt-cache/jwt-cache.module';
import { MailModule } from 'src/mail/mail.module';
import { GoogleStrategy } from './google.strategy';
import { GoogleController } from './google.controller';
import { AppConfigModule } from 'src/config/config.module';

@Module({
  imports: [
    AppConfigModule,
    TypeOrmModule.forFeature([Role, Menu, User, RefreshToken]),
    JwtModule.registerAsync({
      imports: [AppConfigModule],
      useFactory: async (config: AppConfigService) => ({
        secret: config.jwtSecret,
        signOptions: { expiresIn: '24h' },
      }),
      inject: [AppConfigService],
    }),
    JwtCacheModule,
    MailModule,
  ],
  controllers: [GoogleController],
  providers: [
    AuthService,
    AuthResolver,
    GoogleStrategy,
    JWTAuthGuard,
    // Registered here rather than app.module because the guard needs
    // JwtService/JwtCacheService, which live in this module's context.
    // APP_GUARD is global regardless of where it is provided: every GraphQL
    // operation is denied without a token unless marked @Public().
    {
      provide: APP_GUARD,
      useClass: GqlDefaultAuthGuard,
    },
  ],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
