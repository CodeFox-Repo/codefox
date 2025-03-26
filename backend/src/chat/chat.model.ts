import { Field, ObjectType, ID, registerEnumType } from '@nestjs/graphql';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  RelationId,
} from 'typeorm';
import { Message } from 'src/chat/message.model';
import { SystemBaseModel } from 'src/system-base-model/system-base.model';
import { User } from 'src/user/user.model';
import { Project } from 'src/project/project.model';

export enum StreamStatus {
  STREAMING = 'streaming',
  DONE = 'done',
}

registerEnumType(StreamStatus, {
  name: 'StreamStatus',
});

@Entity()
@ObjectType()
export class Chat extends SystemBaseModel {
  @PrimaryGeneratedColumn('uuid')
  @Field(() => ID)
  id: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  title: string;

  @Field(() => [Message], { nullable: true })
  @Column('simple-json', {
    nullable: true,
    default: '[]',
    transformer: {
      to: (messages: Message[]) => messages,
      from: (value: any) => {
        return value?.map((message: any) => ({
          ...message,
          createdAt: message.createdAt ? new Date(message.createdAt) : null,
          updatedAt: message.updatedAt ? new Date(message.updatedAt) : null,
        }));
      },
    },
  })
  messages: Message[];

  @ManyToOne(() => User, (user) => user.chats, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'user_id' })
  @Field(() => User)
  user: User;

  // Adding relation id to easily access the user id
  @RelationId((chat: Chat) => chat.user)
  @Field(() => ID)
  userId: string;

  @ManyToOne(() => Project, (project) => project.chats)
  @Field(() => Project, { nullable: true })
  project: Project;
}

@ObjectType('ChatCompletionDeltaType')
class ChatCompletionDelta {
  @Field({ nullable: true })
  content?: string;
}

@ObjectType('ChatCompletionChoiceType')
class ChatCompletionChoice {
  @Field({ nullable: true })
  index: number | null;

  @Field(() => ChatCompletionDelta, { nullable: true })
  delta: ChatCompletionDelta | null;

  @Field({ nullable: true })
  finishReason: string | null;
}

@ObjectType('ChatCompletionChunkType')
export class ChatCompletionChunk {
  @Field()
  id: string;

  @Field({ nullable: true })
  object: string | null;

  @Field({ nullable: true })
  created: number | null;

  @Field({ nullable: true })
  model: string | null;

  @Field({ nullable: true })
  systemFingerprint: string | null;

  @Field(() => [ChatCompletionChoice])
  choices: ChatCompletionChoice[];

  @Field(() => StreamStatus)
  status: StreamStatus;
}

export function isDoneStatus(chunk: ChatCompletionChunk): boolean {
  return chunk.status === StreamStatus.DONE;
}
