import { Module } from '@nestjs/common';
import { ChatResolver } from './chat.resolver';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/user/user.model';
import { Chat } from './chat.model';
import { ChatGuard } from '../common/guards/chat.guard';
import { AuthModule } from '../auth/auth.module';
import { UserService } from 'src/user/user.service';
import { JwtCacheModule } from 'src/jwt-cache/jwt-cache.module';
import { UploadModule } from 'src/upload/upload.module';
// import { GitHubModule } from 'src/github/github.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Chat, User]),
    AuthModule,
    JwtCacheModule,
    UploadModule,
    // GitHubModule,
  ],
  controllers: [ChatController],
  providers: [ChatResolver, ChatService, ChatGuard, UserService],
  exports: [ChatService, ChatGuard],
})
export class ChatModule {}
