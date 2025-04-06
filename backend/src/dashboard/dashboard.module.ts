import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardResolver } from './dashboard.resolver';
import { DashboardService } from './dashboard.service';

// Models
import { User } from '../user/user.model';
import { Role } from '../auth/role/role.model';
import { Chat } from '../chat/chat.model';
import { Project } from '../project/project.model';
import { ProjectPackages } from '../project/project-packages.model';

// Related modules
import { UserModule } from '../user/user.module';
import { AuthModule } from '../auth/auth.module';
import { ChatModule } from '../chat/chat.module';
import { ProjectModule } from '../project/project.module';
import { JwtCacheModule } from '../jwt-cache/jwt-cache.module';
import { Menu } from 'src/decorator/menu.decorator';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Role,
      Chat,
      Project,
      ProjectPackages,
      Menu,
    ]),
    UserModule,
    AuthModule,
    ChatModule,
    ProjectModule,
    JwtCacheModule,
  ],
  providers: [DashboardResolver, DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
