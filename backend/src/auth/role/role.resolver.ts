import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { RoleService } from './role.service';
import { Role } from './role.model';
import { CreateRoleInput } from './dto/create-role.input';
import { UpdateRoleInput } from './dto/update-role.input';
import { RequireAuth } from '../../decorator/auth.decorator';

@Resolver(() => Role)
export class RoleResolver {
  constructor(private readonly roleService: RoleService) {}

  @Query(() => [Role])
  @RequireAuth({
    roles: ['admin'],
    menuPath: '/role/list',
  })
  async roles(): Promise<Role[]> {
    return this.roleService.findAll();
  }

  @Query(() => Role)
  @RequireAuth({
    roles: ['admin'],
    menuPath: '/role/detail',
  })
  async role(@Args('id', { type: () => ID }) id: string): Promise<Role> {
    return this.roleService.findOne(id);
  }

  @Mutation(() => Role)
  @RequireAuth({
    roles: ['admin'],
    menuPath: '/role/create',
  })
  async createRole(
    @Args('createRoleInput') createRoleInput: CreateRoleInput,
  ): Promise<Role> {
    return this.roleService.create(createRoleInput);
  }

  @Mutation(() => Role)
  @RequireAuth({
    roles: ['admin'],
    menuPath: '/role/update',
  })
  async updateRole(
    @Args('updateRoleInput') updateRoleInput: UpdateRoleInput,
  ): Promise<Role> {
    return this.roleService.update(updateRoleInput.id, updateRoleInput);
  }

  @Mutation(() => Boolean)
  @RequireAuth({
    roles: ['admin'],
    menuPath: '/role/delete',
  })
  async removeRole(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.roleService.remove(id);
  }
}
