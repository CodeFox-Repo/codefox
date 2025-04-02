import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from './role.model';
import { Menu } from '../menu/menu.model';
import { CreateRoleInput } from './dto/create-role.input';
import { UpdateRoleInput } from './dto/update-role.input';

@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(Menu)
    private readonly menuRepository: Repository<Menu>,
  ) {}

  async create(createRoleInput: CreateRoleInput): Promise<Role> {
    const { menuIds, ...roleData } = createRoleInput;
    const role = this.roleRepository.create(roleData);

    if (menuIds?.length) {
      const menus = await this.menuRepository.findByIds(menuIds);
      role.menus = menus;
    }

    return this.roleRepository.save(role);
  }

  async findAll(): Promise<Role[]> {
    return this.roleRepository.find({
      relations: ['menus', 'users'],
    });
  }

  async findOne(id: string): Promise<Role> {
    const role = await this.roleRepository.findOne({
      where: { id },
      relations: ['menus', 'users'],
    });

    if (!role) {
      throw new NotFoundException(`Role with ID "${id}" not found`);
    }

    return role;
  }

  async update(id: string, updateRoleInput: UpdateRoleInput): Promise<Role> {
    const role = await this.findOne(id);
    const { menuIds, ...roleData } = updateRoleInput;

    Object.assign(role, roleData);

    if (menuIds !== undefined) {
      const menus = menuIds.length
        ? await this.menuRepository.findByIds(menuIds)
        : [];
      role.menus = menus;
    }

    return this.roleRepository.save(role);
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.roleRepository.delete(id);
    return result.affected > 0;
  }

  async findByName(name: string): Promise<Role> {
    return this.roleRepository.findOne({
      where: { name },
      relations: ['menus', 'users'],
    });
  }
}
