// DTOs for Project APIs
import { InputType, Field } from '@nestjs/graphql';
import { MessageRole, TurnStep } from '../message.model';

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
  // Deliberately `String`, not `MessageRole`: the GraphQL enum's wire form is
  // the NAME ("Assistant"), while this column stores — and `getChatHistory`
  // reads back — the VALUE ("assistant"), which is what every client sends.
  // Typing this as the enum flips the accepted spelling and breaks every save.
  //
  // The cost is that the field takes any string, and a wrong one is not
  // rejected: it is written to the messages column, and `getChatHistory` then
  // throws `Enum "Role" cannot represent value: …` for that chat forever. The
  // UI shows "This project could not be opened" and nothing in the product can
  // undo it. `normaliseRole` below is the guard, applied on write.
  @Field()
  role: MessageRole;

  /** The agent's working notes, so a reloaded chat can replay them. */
  @Field(() => [TurnStep], { nullable: true })
  steps?: TurnStep[];
}
