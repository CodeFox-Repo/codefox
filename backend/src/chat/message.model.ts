import {
  Field,
  ID,
  InputType,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';

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

/**
 * One thing the agent did on the way to an answer.
 *
 * Stored alongside the message so a reloaded chat can still fold open the
 * work — a turn is narration, a tool call, more narration, and only the last
 * words are the answer. Flat and all-optional rather than a union: GraphQL
 * inputs cannot express one, and the shape is small enough not to need it.
 */
@ObjectType('TurnStepType')
@InputType('TurnStepInput')
export class TurnStep {
  /** `text` or `tool`. */
  @Field()
  kind: string;

  @Field({ nullable: true })
  text?: string;

  @Field({ nullable: true })
  tool?: string;

  @Field({ nullable: true })
  file?: string;
}

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

  /** Absent on user messages and on anything saved before this existed. */
  @Field(() => [TurnStep], { nullable: true })
  steps?: TurnStep[];
}
