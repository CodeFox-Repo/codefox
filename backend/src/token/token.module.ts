import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APIToken } from './api-token.model';

@Module({
  imports: [TypeOrmModule.forFeature([APIToken])],
  // providers: [TokenService],
  // exports: [TokenService],
})
export class TokenModule {}
