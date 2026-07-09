import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
@ObjectType()
export class TelemetryLog {
  @PrimaryGeneratedColumn()
  @Field(() => ID)
  id: number;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  @Field(() => Date)
  timestamp: Date;

  @Column()
  @Field()
  requestMethod: string;

  @Column('text')
  @Field()
  endpoint: string;

  @Column('text', { nullable: true })
  @Field({ nullable: true })
  input: string;

  @Column('text', { nullable: true })
  @Field({ nullable: true })
  output: string;

  @Column({ nullable: true })
  @Field({ nullable: true })
  inputToken: string;

  @Column({ nullable: true })
  @Field({ nullable: true })
  outputToken: string;

  @Column('int')
  @Field()
  timeConsumed: number;

  @Column({ nullable: true })
  @Field({ nullable: true })
  userId: string;

  @Column({ nullable: true })
  @Field({ nullable: true })
  email: string;

  @Column({ nullable: true })
  @Field({ nullable: true })
  handler: string;
}
