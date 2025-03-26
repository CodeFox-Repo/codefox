// DTOs for Project APIs
import { InputType, Field } from '@nestjs/graphql';
import { MessageRole } from '../message.model';

@InputType()
export class NewChatInput {
  @Field({ nullable: true })
  title: string;
}

@InputType()
export class UpdateChatTitleInput {
  @Field()
  chatId: string;

  @Field({ nullable: true })
  title: string;
}

// TODO: using ChatInput in model-provider.ts
@InputType('ChatInputType')
export class ChatInput {
  @Field()
  chatId: string;
  @Field()
  message: string;

  @Field()
  model: string;
  @Field()
  role: MessageRole;
}
