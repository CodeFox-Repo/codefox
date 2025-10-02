import { ObjectType, Field, ID } from '@nestjs/graphql';
import { SystemBaseModel } from 'src/common/models/system-base.model';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from 'src/user/user.model';

@Entity()
@ObjectType()
export class APIToken extends SystemBaseModel {
  @Field(() => ID)
  @PrimaryGeneratedColumn()
  id: string;

  @Field(() => ID)
  @Column()
  user_id: string;

  @Field()
  @Column()
  api: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
