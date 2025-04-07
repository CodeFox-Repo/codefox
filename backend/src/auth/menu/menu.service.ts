import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Menu } from './menu.model';
import { CreateMenuInput } from './dto/create-menu.input';
import { UpdateMenuInput } from './dto/update-menu.input';

@Injectable()
export class MenuService {
  constructor(
    @InjectRepository(Menu)
    private readonly menuRepository: Repository<Menu>,
  ) {}

  async create(createMenuInput: CreateMenuInput): Promise<Menu> {
    const menu = this.menuRepository.create(createMenuInput);
    return this.menuRepository.save(menu);
  }

  async findAll(): Promise<Menu[]> {
    return this.menuRepository.find({
      relations: ['roles'],
    });
  }

  async findOne(id: string): Promise<Menu> {
    const menu = await this.menuRepository.findOne({
      where: { id },
      relations: ['roles'],
    });

    if (!menu) {
      throw new NotFoundException(`Menu with ID "${id}" not found`);
    }

    return menu;
  }

  async update(id: string, updateMenuInput: UpdateMenuInput): Promise<Menu> {
    const menu = await this.findOne(id);
    Object.assign(menu, updateMenuInput);
    return this.menuRepository.save(menu);
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.menuRepository.delete(id);
    return result.affected > 0;
  }

  async findByPermission(permission: string): Promise<Menu[]> {
    return this.menuRepository.find({
      where: { permission },
      relations: ['roles'],
    });
  }

  async findByPath(path: string): Promise<Menu> {
    const menu = await this.menuRepository.findOne({
      where: { path },
      relations: ['roles'],
    });

    if (!menu) {
      throw new NotFoundException(`Menu with path "${path}" not found`);
    }

    return menu;
  }
}
