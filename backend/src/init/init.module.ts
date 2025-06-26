import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from '../auth/role/role.model';
import { Menu } from '../auth/menu/menu.model';
import { InitRolesService } from './init-roles.service';
import { InitMenusService } from './init-menus.service';
import { UserInitService } from './init-user.service';
import { User } from 'src/user/user.model';

@Module({
  imports: [TypeOrmModule.forFeature([Role, Menu, User])],
  providers: [
    UserInitService,
    InitRolesService,
    // Add InitMenusService after InitRolesService to ensure roles are created first
    InitMenusService,
  ],
})
export class InitModule {}
