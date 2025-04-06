import { Field, InputType, ID } from '@nestjs/graphql';

@InputType()
export class ChatFilterInput {
  @Field({ nullable: true })
  search?: string;

  @Field({ nullable: true })
  userId?: string;

  @Field({ nullable: true })
  projectId?: string;

  @Field({ nullable: true })
  isActive?: boolean;

  @Field({ nullable: true })
  isDeleted?: boolean;
}

@InputType()
export class CreateChatInput {
  @Field()
  title: string;

  @Field(() => ID)
  userId: string;

  @Field(() => ID, { nullable: true })
  projectId?: string;
}

@InputType()
export class UpdateChatInput {
  @Field({ nullable: true })
  title?: string;

  @Field({ nullable: true })
  isActive?: boolean;
}
