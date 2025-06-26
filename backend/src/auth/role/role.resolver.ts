import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { RoleService } from './role.service';
import { Role } from './role.model';
import { CreateRoleInput } from './dto/create-role.input';
import { UpdateRoleInput } from './dto/update-role.input';
import { RequireAuth } from '../../decorator/auth.decorator';
import { UseGuards } from '@nestjs/common';
import { JWTAuthGuard } from 'src/guard/jwt-auth.guard';

@UseGuards(JWTAuthGuard)
@Resolver(() => Role)
export class RoleResolver {
  constructor(private readonly roleService: RoleService) {}

  @Query(() => [Role])
  @RequireAuth({
    roles: ['Admin'],
    menuPath: '/role/list',
  })
  async roles(): Promise<Role[]> {
    return this.roleService.findAll();
  }

  @Query(() => Role)
  @RequireAuth({
    roles: ['Admin'],
    menuPath: '/role/detail',
  })
  async role(@Args('id', { type: () => ID }) id: string): Promise<Role> {
    return this.roleService.findOne(id);
  }

  @Mutation(() => Role)
  @RequireAuth({
    roles: ['Admin'],
    menuPath: '/role/create',
  })
  async createRole(
    @Args('createRoleInput') createRoleInput: CreateRoleInput,
  ): Promise<Role> {
    return this.roleService.create(createRoleInput);
  }

  @Mutation(() => Role)
  @RequireAuth({
    roles: ['Admin'],
    menuPath: '/role/update',
  })
  async updateRole(
    @Args('updateRoleInput') updateRoleInput: UpdateRoleInput,
  ): Promise<Role> {
    return this.roleService.update(updateRoleInput.id, updateRoleInput);
  }

  @Mutation(() => Boolean)
  @RequireAuth({
    roles: ['Admin'],
    menuPath: '/role/delete',
  })
  async removeRole(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.roleService.remove(id);
  }
}
