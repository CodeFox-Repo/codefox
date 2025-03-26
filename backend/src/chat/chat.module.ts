import { Module } from '@nestjs/common';
import { ChatResolver } from './chat.resolver';
import { ChatController } from './chat.controller';
import { ChatProxyService, ChatService } from './chat.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/user/user.model';
import { Chat } from './chat.model';
import { ChatGuard } from '../guard/chat.guard';
import { AuthModule } from '../auth/auth.module';
import { UserService } from 'src/user/user.service';
import { PubSub } from 'graphql-subscriptions';
import { JwtCacheModule } from 'src/jwt-cache/jwt-cache.module';
import { UploadModule } from 'src/upload/upload.module';
import { GitHubModule } from 'src/github/github.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Chat, User]),
    AuthModule,
    JwtCacheModule,
    UploadModule,
    GitHubModule,
  ],
  controllers: [ChatController],
  providers: [
    ChatResolver,
    ChatProxyService,
    ChatService,
    ChatGuard,
    UserService,
    {
      provide: 'PUB_SUB',
      useValue: new PubSub(),
    },
  ],
  exports: [ChatService, ChatGuard],
})
export class ChatModule {}
