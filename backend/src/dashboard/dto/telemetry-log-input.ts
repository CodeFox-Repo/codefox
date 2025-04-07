import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class TelemetryLogFilterInput {
  @Field(() => Date, { nullable: true })
  startDate?: Date;

  @Field(() => Date, { nullable: true })
  endDate?: Date;

  @Field({ nullable: true })
  requestMethod?: string;

  @Field({ nullable: true })
  endpoint?: string;

  @Field({ nullable: true })
  userId?: string;

  @Field({ nullable: true })
  handler?: string;

  @Field(() => Number, { nullable: true })
  minTimeConsumed?: number;

  @Field(() => Number, { nullable: true })
  maxTimeConsumed?: number;

  @Field({ nullable: true })
  search?: string;
}
