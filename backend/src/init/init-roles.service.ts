import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../auth/role.model';
import { DefaultRoles } from '../common/enums/role.enum';

@Injectable()
export class InitRolesService implements OnApplicationBootstrap {
  private readonly logger = new Logger(InitRolesService.name);

  constructor(
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
  ) {}

  async onApplicationBootstrap() {
    await this.initializeDefaultRoles();
  }

  private async initializeDefaultRoles() {
    this.logger.log('Checking and initializing default roles...');

    const defaultRoles = Object.values(DefaultRoles);

    for (const roleName of defaultRoles) {
      const existingRole = await this.roleRepository.findOne({
        where: { name: roleName },
      });

      if (!existingRole) {
        await this.createDefaultRole(roleName);
      }
    }

    this.logger.log('Default roles initialization completed');
  }

  private async createDefaultRole(roleName: string) {
    try {
      const newRole = this.roleRepository.create({
        name: roleName,
        description: `Default ${roleName} role`,
        menus: [],
      });

      await this.roleRepository.save(newRole);
      this.logger.log(`Created default role: ${roleName}`);
    } catch (error) {
      this.logger.error(
        `Failed to create default role ${roleName}:`,
        error.message,
      );
      throw error;
    }
  }
}
