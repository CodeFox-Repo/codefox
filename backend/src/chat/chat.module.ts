import { Module } from '@nestjs/common';
import { ProjectModule } from 'src/project/project.module';
import { ChatResolver } from './chat.resolver';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/user/user.model';
import { Chat } from './chat.model';
import { AgentTurn } from './agent-turn.model';
import { ChatGuard } from '../common/guards/chat.guard';
import { AuthModule } from '../auth/auth.module';
import { UserService } from 'src/user/user.service';
import { JwtCacheModule } from 'src/jwt-cache/jwt-cache.module';
import { UploadModule } from 'src/upload/upload.module';
import { Project } from 'src/project/project.model';
import { WorkspaceService } from 'src/project/workspace.service';
// import { GitHubModule } from 'src/github/github.module';

@Module({
  imports: [
    // Project: the controller snapshots a turn's file changes, which needs a
    // workspace, which resolves the project's kind. AgentTurn: one row per
    // turn, the only thing that joins a version sha to the chat, user, model
    // and prompt that produced it.
    TypeOrmModule.forFeature([Chat, User, Project, AgentTurn]),
    AuthModule,
    JwtCacheModule,
    UploadModule,
    // For the single PreviewService: a second instance would keep its own map
    // of running dev servers, invisible to the proxy and the idle sweeper.
    ProjectModule,
    // GitHubModule,
  ],
  controllers: [ChatController],
  providers: [
    ChatResolver,
    ChatService,
    ChatGuard,
    UserService,
    // Declared here rather than imported from ProjectModule, which already
    // pulls ChatService in — importing it back would close the cycle. This
    // provider is stateless; PreviewService, which is not, comes from the
    // one instance ProjectModule owns.
    WorkspaceService,
  ],
  exports: [ChatService, ChatGuard],
})
export class ChatModule {}
