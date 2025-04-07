import { Field, InputType, ID } from '@nestjs/graphql';

@InputType()
export class ProjectFilterInput {
  @Field({ nullable: true })
  search?: string;

  @Field({ nullable: true })
  userId?: string;

  @Field({ nullable: true })
  isPublic?: boolean;

  @Field({ nullable: true })
  isActive?: boolean;

  @Field({ nullable: true })
  isDeleted?: boolean;

  @Field(() => Date, { nullable: true })
  createdAfter?: Date;

  @Field(() => Date, { nullable: true })
  createdBefore?: Date;
}
@InputType()
export class UpdateProjectInput {
  @Field({ nullable: true })
  projectName?: string;

  @Field({ nullable: true })
  projectPath?: string;

  @Field({ nullable: true })
  isPublic?: boolean;

  @Field({ nullable: true })
  isActive?: boolean;

  @Field(() => [ID], { nullable: true })
  packageIds?: string[];
}
