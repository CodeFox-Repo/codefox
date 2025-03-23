import { Field, ObjectType, ID, registerEnumType } from '@nestjs/graphql';

/**
 * Represents the different roles in a chat conversation
 */
export enum MessageRole {
  /**
   * Represents the end user who sends queries or requests to the model.
   * Contains questions, instructions, or any input that requires a response.
   */
  User = 'user',

  /**
   * Represents the AI model's responses in the conversation.
   * Contains generated answers, explanations, or any output based on user input.
   */
  Assistant = 'assistant',

  /**
   * Represents system-level instructions that define the behavior and context.
   * Used to set the model's personality, constraints, and background information.
   * Typically appears at the start of a conversation.
   */
  System = 'system',
}

registerEnumType(MessageRole, {
  name: 'Role',
});

@ObjectType()
export class Message {
  @Field(() => ID)
  id: string;

  @Field()
  content: string;

  @Field(() => MessageRole)
  role: MessageRole;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;

  @Field()
  isActive: boolean;

  @Field()
  isDeleted: boolean;

  @Field({ nullable: true })
  modelId?: string;
}
