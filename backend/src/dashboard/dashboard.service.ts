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

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
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

  async createUser(input: CreateUserInput): Promise<User> {
    const hashedPassword = await hash(input.password, 10);
    const user = this.userRepository.create({
      ...input,
      password: hashedPassword,
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
