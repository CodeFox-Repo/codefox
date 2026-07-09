// This is combination of RolesGuard, MenuGuard, roles.decorator.ts, menu.decorator.ts, auth.decorator.ts
// Example usage:
// @Query(() => [Project])
// @RequireRoles('Admin', 'Manager')
// @RequireMenu('/project/create')
// @RequireAuth({
//   roles: ['Admin'],
//   menuPath: '/project/detail'
// })
// async getProjects() {
//   return this.projectService.findAll();
// }
import { applyDecorators, UseGuards } from '@nestjs/common';
import { Roles } from './roles.decorator';
import { Menu } from './menu.decorator';
import { RolesGuard } from 'src/guard/roles.guard';
import { MenuGuard } from 'src/guard/menu.guard';

export function Auth() {
  return applyDecorators(UseGuards(RolesGuard, MenuGuard));
}

export function RequireRoles(...roles: string[]) {
  return applyDecorators(Roles(...roles), UseGuards(RolesGuard));
}

export function RequireMenu(path: string) {
  return applyDecorators(Menu(path), UseGuards(MenuGuard));
}

export function RequireAuth(options?: { roles?: string[]; menuPath?: string }) {
  if (!options) {
    return Auth();
  }

  const decorators = [Auth()];

  if (options.roles?.length) {
    decorators.push(Roles(...options.roles));
  }

  if (options.menuPath) {
    decorators.push(Menu(options.menuPath));
  }

  return applyDecorators(...decorators);
}
