import { Field, InputType } from '@nestjs/graphql';
import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';

@InputType()
export class CreateMenuInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  name: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  path: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  permission: string;

  @Field(() => [String], { nullable: true })
  @IsArray()
  @IsOptional()
  roleIds?: string[];
}
