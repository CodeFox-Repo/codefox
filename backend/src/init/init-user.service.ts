import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/user.model';
import { Role } from '../auth/role/role.model';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserInitService implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
  ) {}

  async onModuleInit() {
    await this.initializeAdminRole();
    await this.initializeAdminUser();
  }

  private async initializeAdminRole(): Promise<Role> {
    let adminRole = await this.roleRepository.findOne({
      where: { name: 'Admin' },
    });

    if (!adminRole) {
      await this.roleRepository.insert({
        name: 'Admin',
        description: 'Administrator role with full access',
      });

      // 重新读取一次，确保返回的 role 是“有 id”的 managed entity
      adminRole = await this.roleRepository.findOne({
        where: { name: 'Admin' },
      });
    }

    return adminRole!;
  }

  private async initializeAdminUser(): Promise<void> {
    const existingAdmin = await this.userRepository.findOne({
      where: { email: 'admin@codefox.com' },
      relations: ['roles'],
    });

    if (existingAdmin) {
      return;
    }

    const adminRole = await this.initializeAdminRole();
    const hashedPassword = await bcrypt.hash('admin123', 10);

    const adminUser = this.userRepository.create({
      username: 'admin',
      email: 'admin@codefox.com',
      password: hashedPassword,
      isEmailConfirmed: true,
      roles: [adminRole],
    });

    await this.userRepository.save(adminUser);
    console.log(adminUser);
  }
}
