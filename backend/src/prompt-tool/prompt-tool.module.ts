import { Module } from '@nestjs/common';
import { ProjectModule } from '../project/project.module';
import { PromptToolService } from './prompt-tool.service';
import { PromptToolResolver } from './prompt-tool.resolver';
import { AuthModule } from '../auth/auth.module';
import { JwtCacheModule } from 'src/jwt-cache/jwt-cache.module';

@Module({
  imports: [ProjectModule, JwtCacheModule, AuthModule],
  providers: [PromptToolResolver, PromptToolService],
})
export class PromptToolModule {}
