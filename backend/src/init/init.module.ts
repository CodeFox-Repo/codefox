import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from '../auth/role/role.model';
import { Menu } from '../auth/menu/menu.model';
import { InitRolesService } from './init-roles.service';
import { InitMenusService } from './init-menus.service';

@Module({
  imports: [TypeOrmModule.forFeature([Role, Menu])],
  providers: [
    InitRolesService,
    // Add InitMenusService after InitRolesService to ensure roles are created first
    InitMenusService,
  ],
})
export class InitModule {}
