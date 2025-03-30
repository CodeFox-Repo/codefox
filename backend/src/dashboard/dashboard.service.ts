import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/user.model';
import {
  CreateUserInput,
  UpdateUserInput,
  UserFilterInput,
} from './dto/user-input';
import { hash } from 'bcrypt';
import { Role } from '../auth/role/role.model';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
  ) {}

  async findUsers(filter?: UserFilterInput): Promise<User[]> {
    const query = this.userRepository.createQueryBuilder('user');

    if (filter?.search) {
      query.where('(user.username LIKE :search OR user.email LIKE :search)', {
        search: `%${filter.search}%`,
      });
    }

    if (filter?.isActive !== undefined) {
      query.andWhere('user.isActive = :isActive', {
        isActive: filter.isActive,
      });
    }

    return query.getMany();
  }

  async findUserById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async findUserByEmailWithRoles(email: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { email },
      relations: ['roles'],
    });
    return user;
  }

  async createUser(input: CreateUserInput): Promise<User> {
    const hashedPassword = await hash(input.password, 10);

    let roles = [];
    if (input.roleIds?.length > 0) {
      roles = await this.roleRepository.findByIds(input.roleIds);
      if (roles.length !== input.roleIds.length) {
        throw new NotFoundException('One or more roles not found');
      }
    }

    const user = this.userRepository.create({
      ...input,
      password: hashedPassword,
      roles,
    });

    return this.userRepository.save(user);
  }

  async updateUser(id: string, input: UpdateUserInput): Promise<User> {
    const user = await this.findUserById(id);

    if (input.password) {
      input.password = await hash(input.password, 10);
    }

    Object.assign(user, input);
    return this.userRepository.save(user);
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await this.userRepository.delete(id);
    return result.affected > 0;
  }
}
