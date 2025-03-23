import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ProjectGuard } from '../guard/project.guard';
import { ChatService } from 'src/chat/chat.service';
import { User } from 'src/user/user.model';
import { Chat } from 'src/chat/chat.model';
import { AppConfigModule } from 'src/config/config.module';
import { UploadModule } from 'src/upload/upload.module';
import { GitHubAppService } from './githubApp.service';
import { GitHubService } from './github.service';
import { Project } from 'src/project/project.model';
import { ProjectPackages } from 'src/project/project-packages.model';
import { GitHuController } from './github.controller';
import { ProjectService } from 'src/project/project.service';
import { UserModule } from 'src/user/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, Chat, User, ProjectPackages]),
    AuthModule,
    AppConfigModule,
    UploadModule,
    forwardRef(() => UserModule),
  ],
  controllers: [GitHuController],
  providers: [
    ProjectService,
    ProjectGuard,
    GitHubAppService,
    GitHubService,
    ChatService,
  ],
  exports: [GitHubService],
})
export class GitHubModule {}
