import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Chat } from 'src/chat/chat.model';
import { User } from 'src/user/user.model';
import { AuthModule } from '../auth/auth.module';
import { Role } from '../auth/role.model';
import { JwtCacheModule } from '../jwt-cache/jwt-cache.module';
import { Project } from '../project/project.model';
import { ProjectModule } from '../project/project.module';
import { AdminResolver } from './admin.resolver';
import { AdminService } from './admin.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, User, Chat, Role]),
    // ProjectModule exports PreviewService and ProjectService: the console
    // reuses the product's own delete rather than reimplementing it, so an
    // admin delete stops the dev server and drops the files like any other.
    ProjectModule,
    AuthModule,
    JwtCacheModule,
  ],
  providers: [AdminService, AdminResolver],
})
export class AdminModule {}
