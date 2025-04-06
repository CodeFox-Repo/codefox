import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Menu } from './menu/menu.model';
import { JwtModule } from '@nestjs/jwt';
import { Role } from './role/role.model';
import { AuthService } from './auth.service';
import { User } from 'src/user/user.model';
import { AppConfigService } from 'src/config/config.service';
import { AuthResolver } from './auth.resolver';
import { RefreshToken } from './refresh-token/refresh-token.model';
import { JwtCacheModule } from 'src/jwt-cache/jwt-cache.module';
import { MailModule } from 'src/mail/mail.module';
import { AppConfigModule } from 'src/config/config.module';
import { RoleResolver } from './role/role.resolver';
import { MenuResolver } from './menu/menu.resolver';
import { RoleService } from './role/role.service';
import { MenuService } from './menu/menu.service';

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
  providers: [
    AuthService,
    AuthResolver,
    RoleResolver,
    MenuResolver,
    RoleService,
    MenuService,
  ],
  exports: [AuthService, RoleService, MenuService, JwtModule],
})
export class AuthModule {}
