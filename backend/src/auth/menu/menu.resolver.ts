import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { Menu } from './menu.model';
import { MenuService } from './menu.service';
import { CreateMenuInput } from './dto/create-menu.input';
import { UpdateMenuInput } from './dto/update-menu.input';
import { RequireAuth } from '../../decorator/auth.decorator';

@Resolver(() => Menu)
export class MenuResolver {
  constructor(private readonly menuService: MenuService) {}

  @Query(() => [Menu])
  @RequireAuth({
    roles: ['admin'],
    menuPath: '/menu/list',
  })
  async menus(): Promise<Menu[]> {
    return this.menuService.findAll();
  }

  @Query(() => Menu)
  @RequireAuth({
    roles: ['admin'],
    menuPath: '/menu/detail',
  })
  async menu(@Args('id', { type: () => ID }) id: string): Promise<Menu> {
    return this.menuService.findOne(id);
  }

  @Query(() => [Menu])
  @RequireAuth({
    roles: ['admin'],
    menuPath: '/menu/permission',
  })
  async menusByPermission(
    @Args('permission') permission: string,
  ): Promise<Menu[]> {
    return this.menuService.findByPermission(permission);
  }

  @Mutation(() => Menu)
  @RequireAuth({
    roles: ['admin'],
    menuPath: '/menu/create',
  })
  async createMenu(
    @Args('createMenuInput') createMenuInput: CreateMenuInput,
  ): Promise<Menu> {
    return this.menuService.create(createMenuInput);
  }

  @Mutation(() => Menu)
  @RequireAuth({
    roles: ['admin'],
    menuPath: '/menu/update',
  })
  async updateMenu(
    @Args('updateMenuInput') updateMenuInput: UpdateMenuInput,
  ): Promise<Menu> {
    return this.menuService.update(updateMenuInput.id, updateMenuInput);
  }

  @Mutation(() => Boolean)
  @RequireAuth({
    roles: ['admin'],
    menuPath: '/menu/delete',
  })
  async removeMenu(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.menuService.remove(id);
  }
}
