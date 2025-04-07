import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../auth/role/role.model';
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

    try {
      // Create Admin role
      await this.ensureRoleExists({
        name: DefaultRoles.ADMIN,
        description: 'Administrator with full system access',
      });

      this.logger.log('Default roles initialization completed');
    } catch (error) {
      this.logger.error('Failed to initialize roles:', error.message);
      throw error;
    }
  }

  private async ensureRoleExists(roleData: {
    name: string;
    description: string;
  }) {
    try {
      let role = await this.roleRepository.findOne({
        where: { name: roleData.name },
      });

      if (!role) {
        role = this.roleRepository.create(roleData);
        await this.roleRepository.save(role);
        this.logger.log(`Created ${roleData.name} role`);
      } else {
        // Update description if needed
        if (role.description !== roleData.description) {
          role.description = roleData.description;
          await this.roleRepository.save(role);
          this.logger.log(`Updated ${roleData.name} role description`);
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to ensure role ${roleData.name} exists:`,
        error.message,
      );
      throw error;
    }
  }
}
