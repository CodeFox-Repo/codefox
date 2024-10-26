import { Field, InputType, ObjectType } from '@nestjs/graphql';

@ObjectType('ChatCompletionDeltaType')
class ChatCompletionDelta {
  @Field({ nullable: true })
  content?: string;
}

@ObjectType('ChatCompletionChunkType')
export class ChatCompletionChunk {
  @Field()
  id: string;

  @Field()
  object: string;

  @Field()
  created: number;

  @Field()
  model: string;

  @Field({ nullable: true })
  systemFingerprint: string | null;

  @Field(() => [ChatCompletionChoice])
  choices: ChatCompletionChoice[];
}

@ObjectType('ChatCompletionChoiceType')
class ChatCompletionChoice {
  @Field()
  index: number;

  @Field(() => ChatCompletionDelta)
  delta: ChatCompletionDelta;

  @Field({ nullable: true })
  finishReason: string | null;
}

@InputType('ChatInputType')
export class ChatInput {
  @Field()
  message: string;
}
