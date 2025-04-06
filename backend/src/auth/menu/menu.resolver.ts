import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { MenuService } from './menu.service';
import { Menu } from './menu.model';
import { CreateMenuInput } from './dto/create-menu.input';
import { UpdateMenuInput } from './dto/update-menu.input';
import { RequireAuth } from '../../decorator/auth.decorator';
import { JWTAuthGuard } from 'src/guard/jwt-auth.guard';

@UseGuards(JWTAuthGuard)
@Resolver(() => Menu)
export class MenuResolver {
  constructor(private readonly menuService: MenuService) {}

  @Query(() => [Menu])
  @RequireAuth({
    roles: ['Admin'],
    menuPath: '/menu/list',
  })
  async menus(): Promise<Menu[]> {
    return this.menuService.findAll();
  }

  @Query(() => Menu)
  @RequireAuth({
    roles: ['Admin'],
    menuPath: '/menu/detail',
  })
  async menu(@Args('id', { type: () => ID }) id: string): Promise<Menu> {
    return this.menuService.findOne(id);
  }

  @Mutation(() => Menu)
  @RequireAuth({
    roles: ['Admin'],
    menuPath: '/menu/create',
  })
  async createMenu(
    @Args('createMenuInput') createMenuInput: CreateMenuInput,
  ): Promise<Menu> {
    return this.menuService.create(createMenuInput);
  }

  @Mutation(() => Menu)
  @RequireAuth({
    roles: ['Admin'],
    menuPath: '/menu/update',
  })
  async updateMenu(
    @Args('updateMenuInput') updateMenuInput: UpdateMenuInput,
  ): Promise<Menu> {
    return this.menuService.update(updateMenuInput.id, updateMenuInput);
  }

  @Mutation(() => Boolean)
  @RequireAuth({
    roles: ['Admin'],
    menuPath: '/menu/delete',
  })
  async removeMenu(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.menuService.remove(id);
  }
}
