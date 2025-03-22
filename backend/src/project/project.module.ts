import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from './project.model';
import { ProjectPackages } from './project-packages.model';
import { ProjectService } from './project.service';
import { ProjectsResolver } from './project.resolver';
import { AuthModule } from '../auth/auth.module';
import { ProjectGuard } from '../guard/project.guard';
import { ChatService } from 'src/chat/chat.service';
import { User } from 'src/user/user.model';
import { Chat } from 'src/chat/chat.model';
import { AppConfigModule } from 'src/config/config.module';
import { UploadModule } from 'src/upload/upload.module';
import { DownloadController } from './downloadController';
import { GitHubService } from 'src/github/github.service';
import { UserService } from 'src/user/user.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, Chat, User, ProjectPackages]),
    AuthModule,
    AppConfigModule,
    UploadModule,
  ],
  controllers: [DownloadController],
  providers: [
    ChatService,
    ProjectService,
    ProjectsResolver,
    ProjectGuard,
    GitHubService,
    UserService,
  ],
  exports: [ProjectService, ProjectGuard],
})
export class ProjectModule {}
