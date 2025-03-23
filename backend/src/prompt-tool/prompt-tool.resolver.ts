import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { JWTAuth } from '../decorator/jwt-auth.decorator';
import { PromptToolService } from './prompt-tool.service';

@Resolver()
export class PromptToolResolver {
  constructor(private readonly promptService: PromptToolService) {}

  @Mutation(() => String)
  @JWTAuth()
  async regenerateDescription(@Args('input') input: string): Promise<string> {
    return this.promptService.regenerateDescription(input);
  }
}
