import { Field, ID, InputType } from '@nestjs/graphql';
import { IsString, IsOptional, IsArray } from 'class-validator';

@InputType()
export class UpdateMenuInput {
  @Field(() => ID)
  id: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  name?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  path?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  permission?: string;

  @Field({ nullable: true })
  @IsOptional()
  isActive?: boolean;

  @Field(() => [String], { nullable: true })
  @IsArray()
  @IsOptional()
  roleIds?: string[];
}
