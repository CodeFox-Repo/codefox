import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { User } from '../user/user.model';
import { Chat } from '../chat/chat.model';
import { Project } from '../project/project.model';
import { Role } from '../auth/role/role.model';
import { ProjectPackages } from '../project/project-packages.model';
import { hash } from 'bcrypt';

import {
  CreateUserInput,
  UpdateUserInput,
  UserFilterInput,
} from './dto/user-input';

import {
  ChatFilterInput,
  CreateChatInput,
  UpdateChatInput,
} from './dto/chat-input';

import {
  ProjectFilterInput,
  DashboardCreateProjectInput,
  UpdateProjectInput,
} from './dto/project-input';
import { CreateRoleInput } from 'src/auth/role/dto/create-role.input';
import { UpdateRoleInput } from 'src/auth/role/dto/update-role.input';
import { Menu } from 'src/auth/menu/menu.model';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Menu)
    private readonly menuRepository: Repository<Menu>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(Chat)
    private readonly chatRepository: Repository<Chat>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(ProjectPackages)
    private readonly packageRepository: Repository<ProjectPackages>,
  ) {}

  // User Management
  async findUsers(filter?: UserFilterInput): Promise<User[]> {
    const query = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.roles', 'role');
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
    console.log(await query.getMany());
    return await query.getMany();
  }

  async findUserById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async findUserByEmailWithRoles(email: string): Promise<User> {
    return this.userRepository.findOne({
      where: { email },
      relations: ['roles'],
    });
  }

  async createUser(input: CreateUserInput): Promise<User> {
    const hashedPassword = await hash(input.password, 10);

    let roles = [];
    if (input.roleIds && input.roleIds.length > 0) {
      roles = await this.roleRepository.findByIds(input.roleIds);
    }

    const user = this.userRepository.create({
      ...input,
      password: hashedPassword,
      roles,
    });
    console.log('user', user);
    return this.userRepository.save(user);
  }

  async updateUser(id: string, input: UpdateUserInput): Promise<User> {
    const user = await this.findUserById(id);
    console.log('user before update', user);

    if (input.password) {
      input.password = await hash(input.password, 10);
    }

    if (typeof input.roleIds !== 'undefined') {
      const roles =
        input.roleIds.length > 0
          ? await this.roleRepository.findByIds(input.roleIds)
          : [];
      (input as any).roles = roles;
    }

    Object.assign(user, input);
    return this.userRepository.save(user);
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await this.userRepository.delete(id);
    return result.affected > 0;
  }

  // Chat Management
  async findChats(filter?: ChatFilterInput): Promise<Chat[]> {
    const query = this.chatRepository
      .createQueryBuilder('chat')
      .leftJoinAndSelect('chat.user', 'user')
      .leftJoinAndSelect('chat.project', 'project');

    if (filter?.search) {
      query.where('chat.title LIKE :search', { search: `%${filter.search}%` });
    }

    if (filter?.userId) {
      query.andWhere('chat.userId = :userId', { userId: filter.userId });
    }

    if (filter?.projectId) {
      query.andWhere('chat.projectId = :projectId', {
        projectId: filter.projectId,
      });
    }

    if (filter?.isActive !== undefined) {
      query.andWhere('chat.isActive = :isActive', {
        isActive: filter.isActive,
      });
    }

    if (filter?.isDeleted !== undefined) {
      query.andWhere('chat.isDeleted = :isDeleted', {
        isDeleted: filter.isDeleted,
      });
    }

    return query.getMany();
  }

  async findChatById(id: string): Promise<Chat> {
    const chat = await this.chatRepository.findOne({
      where: { id },
      relations: ['user', 'project'],
    });
    if (!chat) {
      throw new NotFoundException(`Chat with ID ${id} not found`);
    }
    return chat;
  }

  async createChat(input: CreateChatInput): Promise<Chat> {
    const chat = this.chatRepository.create(input);
    return this.chatRepository.save(chat);
  }

  async updateChat(id: string, input: UpdateChatInput): Promise<Chat> {
    const chat = await this.findChatById(id);
    Object.assign(chat, input);
    return this.chatRepository.save(chat);
  }

  async deleteChat(id: string): Promise<boolean> {
    const chat = await this.findChatById(id);
    chat.isDeleted = true;
    chat.isActive = false;
    await this.chatRepository.save(chat);
    return true;
  }

  // Project Management
  async findProjects(filter?: ProjectFilterInput): Promise<Project[]> {
    const query = this.projectRepository
      .createQueryBuilder('project')
      .leftJoinAndSelect('project.user', 'user')
      .leftJoinAndSelect('project.projectPackages', 'packages')
      .leftJoinAndSelect('project.chats', 'chats');

    if (filter?.search) {
      query.where('project.projectName LIKE :search', {
        search: `%${filter.search}%`,
      });
    }

    if (filter?.userId) {
      query.andWhere('project.userId = :userId', { userId: filter.userId });
    }

    if (filter?.isPublic !== undefined) {
      query.andWhere('project.isPublic = :isPublic', {
        isPublic: filter.isPublic,
      });
    }

    if (filter?.isActive !== undefined) {
      query.andWhere('project.isActive = :isActive', {
        isActive: filter.isActive,
      });
    }

    if (filter?.isDeleted !== undefined) {
      query.andWhere('project.isDeleted = :isDeleted', {
        isDeleted: filter.isDeleted,
      });
    }

    if (filter?.createdAfter || filter?.createdBefore) {
      query.andWhere({
        createdAt: Between(
          filter.createdAfter || new Date(0),
          filter.createdBefore || new Date(),
        ),
      });
    }

    return query.getMany();
  }

  async findProjectById(id: string): Promise<Project> {
    const project = await this.projectRepository.findOne({
      where: { id },
      relations: ['user', 'projectPackages', 'chats'],
    });
    if (!project) {
      throw new NotFoundException(`Project with ID ${id} not found`);
    }
    return project;
  }

  async createProject(input: DashboardCreateProjectInput): Promise<Project> {
    const project = this.projectRepository.create(input);

    if (input.packageIds?.length) {
      project.projectPackages = await this.packageRepository.findByIds(
        input.packageIds,
      );
    }

    return this.projectRepository.save(project);
  }

  async updateProject(id: string, input: UpdateProjectInput): Promise<Project> {
    const project = await this.findProjectById(id);

    if (input.packageIds !== undefined) {
      project.projectPackages = input.packageIds.length
        ? await this.packageRepository.findByIds(input.packageIds)
        : [];
    }

    Object.assign(project, input);
    return this.projectRepository.save(project);
  }

  async deleteProject(id: string): Promise<boolean> {
    const project = await this.findProjectById(id);
    project.isDeleted = true;
    project.isActive = false;
    await this.projectRepository.save(project);
    return true;
  }

  async findRoles(): Promise<Role[]> {
    return this.roleRepository.find({
      where: { isDeleted: false },
      relations: ['menus', 'users'],
    });
  }

  async findRoleById(id: string): Promise<Role> {
    const role = await this.roleRepository.findOne({
      where: { id },
      relations: ['menus', 'users'],
    });
    if (!role) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }
    return role;
  }

  async createRole(input: CreateRoleInput): Promise<Role> {
    const role = this.roleRepository.create(input);

    if (input.menuIds?.length) {
      const menus = await this.menuRepository.findByIds(input.menuIds);
      role.menus = menus;
    }

    return this.roleRepository.save(role);
  }

  async updateRole(id: string, input: UpdateRoleInput): Promise<Role> {
    const role = await this.findRoleById(id);

    if (input.menuIds !== undefined) {
      const menus = input.menuIds.length
        ? await this.menuRepository.findByIds(input.menuIds)
        : [];
      role.menus = menus;
    }

    Object.assign(role, input);
    return this.roleRepository.save(role);
  }

  async deleteRole(id: string): Promise<boolean> {
    const role = await this.findRoleById(id);
    role.isDeleted = true;
    role.isActive = false;
    await this.roleRepository.save(role);
    return true;
  }
}
