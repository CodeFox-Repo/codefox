import { Module } from '@nestjs/common';
import { DashboardResolver } from './dashboard.resolver';
import { DashboardService } from './dashboard.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/user.model';
import { UserModule } from '../user/user.module';
import { AuthModule } from '../auth/auth.module';
import { JwtCacheModule } from '../jwt-cache/jwt-cache.module';
import { Role } from '../auth/role/role.model';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Role]),
    UserModule,
    AuthModule,
    JwtCacheModule,
  ],
  providers: [DashboardResolver, DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
