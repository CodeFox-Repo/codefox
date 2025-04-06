import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Menu } from '../auth/menu/menu.model';
import { Role } from '../auth/role/role.model';
import { DefaultRoles } from '../common/enums/role.enum';

const DEFAULT_MENUS = [
  // Role management menus
  {
    name: 'Role List',
    path: '/role/list',
    permission: 'role.list',
    description: 'View all roles',
    isActive: true,
  },
  {
    name: 'Role Detail',
    path: '/role/detail',
    permission: 'role.detail',
    description: 'View role details',
    isActive: true,
  },
  {
    name: 'Create Role',
    path: '/role/create',
    permission: 'role.create',
    description: 'Create new roles',
    isActive: true,
  },
  {
    name: 'Update Role',
    path: '/role/update',
    permission: 'role.update',
    description: 'Update existing roles',
    isActive: true,
  },
  {
    name: 'Delete Role',
    path: '/role/delete',
    permission: 'role.delete',
    description: 'Delete roles',
    isActive: true,
  },

  // Menu management menus
  {
    name: 'Menu List',
    path: '/menu/list',
    permission: 'menu.list',
    description: 'View all menus',
    isActive: true,
  },
  {
    name: 'Menu Detail',
    path: '/menu/detail',
    permission: 'menu.detail',
    description: 'View menu details',
    isActive: true,
  },
  {
    name: 'Create Menu',
    path: '/menu/create',
    permission: 'menu.create',
    description: 'Create new menus',
    isActive: true,
  },
  {
    name: 'Update Menu',
    path: '/menu/update',
    permission: 'menu.update',
    description: 'Update existing menus',
    isActive: true,
  },
  {
    name: 'Delete Menu',
    path: '/menu/delete',
    permission: 'menu.delete',
    description: 'Delete menus',
    isActive: true,
  },
];

@Injectable()
export class InitMenusService implements OnApplicationBootstrap {
  private readonly logger = new Logger(InitMenusService.name);

  constructor(
    @InjectRepository(Menu)
    private menuRepository: Repository<Menu>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
  ) {}

  async onApplicationBootstrap() {
    await this.initializeDefaultMenus();
  }

  private async initializeDefaultMenus() {
    this.logger.log('Checking and initializing default menus...');

    // First, ensure all menus exist
    const menus = await this.createOrUpdateMenus();

    // Then, associate them with the admin role
    await this.associateMenusWithAdminRole(menus);

    this.logger.log('Default menus initialization completed');
  }

  private async createOrUpdateMenus(): Promise<Menu[]> {
    const menus: Menu[] = [];

    for (const menuData of DEFAULT_MENUS) {
      let menu = await this.menuRepository.findOne({
        where: { path: menuData.path },
      });

      if (!menu) {
        menu = await this.createMenu(menuData);
      } else {
        // Update existing menu
        Object.assign(menu, menuData);
        menu = await this.menuRepository.save(menu);
      }

      menus.push(menu);
    }

    return menus;
  }

  private async createMenu(menuData: {
    name: string;
    path: string;
    permission: string;
    description: string;
    isActive: boolean;
  }): Promise<Menu> {
    try {
      const menu = this.menuRepository.create(menuData);
      const savedMenu = await this.menuRepository.save(menu);
      this.logger.log(`Created menu: ${menu.path}`);
      return savedMenu;
    } catch (error) {
      this.logger.error(
        `Failed to create menu ${menuData.path}:`,
        error.message,
      );
      throw error;
    }
  }

  private async associateMenusWithAdminRole(menus: Menu[]) {
    try {
      let adminRole = await this.roleRepository.findOne({
        where: { name: DefaultRoles.ADMIN },
        relations: ['menus'],
      });

      if (!adminRole) {
        this.logger.error(
          'Admin role not found. Please ensure roles are initialized first.',
        );
        return;
      }

      adminRole.menus = menus;
      adminRole = await this.roleRepository.save(adminRole);
      this.logger.log(`Associated ${menus.length} menus with admin role`);
    } catch (error) {
      this.logger.error(
        'Failed to associate menus with admin role:',
        error.message,
      );
      throw error;
    }
  }
}
