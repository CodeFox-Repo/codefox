import { Query, Resolver } from '@nestjs/graphql';
import { RequireRoles } from './common/decorators/auth.decorator';

@Resolver()
export class AppResolver {
  @Query(() => String)
  @RequireRoles('Admin')
  getHello(): string {
    return 'Hello World!';
  }
}
