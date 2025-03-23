import { Module } from '@nestjs/common';
import { JwtCacheService } from './jwt-cache.service';

@Module({
  exports: [JwtCacheService],
  providers: [JwtCacheService],
})
export class JwtCacheModule {}
