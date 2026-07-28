import { Module } from '@nestjs/common';
import { JwtCacheModule } from 'src/jwt-cache/jwt-cache.module';
import { FilesController } from './files.controller';
import { ScreenshotController } from './screenshot.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from './project.model';
import { ProjectService } from './project.service';
import { ProjectsResolver } from './project.resolver';
import { AuthModule } from '../auth/auth.module';
import { ProjectGuard } from '../common/guards/project.guard';
import { ChatService } from 'src/chat/chat.service';
import { User } from 'src/user/user.model';
import { Chat } from 'src/chat/chat.model';
import { AppConfigModule } from 'src/config/config.module';
import { UploadModule } from 'src/upload/upload.module';
import { DownloadController } from './downloadController';
import { PreviewController } from './preview.controller';
import { PreviewService } from './preview.service';
import { WorkspaceService } from './workspace.service';
// import { GitHubService } from 'src/github/github.service';
import { UserService } from 'src/user/user.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, Chat, User]),
    AuthModule,
    AppConfigModule,
    UploadModule,
    // JWTAuthGuard needs it, and the download route needs the guard.
    JwtCacheModule,
  ],
  controllers: [
    DownloadController,
    PreviewController,
    FilesController,
    ScreenshotController,
  ],
  providers: [
    ChatService,
    ProjectService,
    ProjectsResolver,
    ProjectGuard,
    PreviewService,
    WorkspaceService,
    // GitHubService,
    UserService,
  ],
  exports: [ProjectService, ProjectGuard, PreviewService],
})
export class ProjectModule {}
