// This module is use for init operation like init roles, init permissions, init users, etc.
// This module is imported in app.module.ts
// @Author: Jackson Chen
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from '../auth/role.model';
import { InitRolesService } from './init-roles.service';

@Module({
  imports: [TypeOrmModule.forFeature([Role])],
  providers: [InitRolesService],
})
export class InitModule {}
