// DTOs for Project APIs
import { InputType, Field, ID, ObjectType } from '@nestjs/graphql';
import {
  IsNotEmpty,
  IsString,
  IsUUID,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { Project } from '../project.model';
import { FileUpload, GraphQLUpload } from 'graphql-upload-minimal';

/**
 * @deprecated We don't need project upsert
 */
@InputType()
export class UpsertProjectInput {
  @Field()
  @IsNotEmpty()
  @IsString()
  projectName: string;

  @Field()
  @IsNotEmpty()
  @IsString()
  path: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsString({ each: true })
  projectPackages?: string[];
}

@InputType()
export class CreateProjectInput {
  @Field(() => String, { nullable: true })
  projectName?: string;

  @Field()
  description: string;

  @Field(() => String, { nullable: true })
  databaseType?: string;

  @Field(() => Boolean, { nullable: true })
  public: boolean;

  /** Left undefined so the service falls back to LLM_DEFAULT_MODEL; a
   *  hardcoded default here silently overrode the configured endpoint. */
  @Field(() => String, { nullable: true })
  model?: string;

  /** 'html' (light, default) or 'next' (full starter). */
  @Field(() => String, { nullable: true })
  template?: string;

  /** Design system id for html projects; unknown ids fall back to the first.
   *  Nothing stores it — it is baked into the scaffolded page's tokens. */
  @Field(() => String, { nullable: true })
  style?: string;
}

@InputType()
export class UpdateProjectPublicStatusInput {
  @Field(() => ID)
  projectId: string;

  @Field()
  isPublic: boolean;
}

@InputType()
export class UpdateProjectPhotoUrlInput {
  @Field(() => ID)
  projectId: string;

  @Field()
  photoUrl: string;
}

@InputType()
export class SubscribeToProjectInput {
  @Field(() => ID)
  projectId: string;
}

@InputType()
export class ForkProjectInput {
  @Field(() => ID)
  projectId: string;
}

@ObjectType()
export class ProjectSubscriptionResult {
  @Field()
  success: boolean;

  @Field({ nullable: true })
  message?: string;

  @Field(() => Project, { nullable: true })
  project?: Project;
}

@InputType()
export class FetchPublicProjectsInputs {
  @Field()
  strategy: 'trending' | 'latest';

  @Field()
  size: number;
}

@InputType()
export class UpdateProjectPhotoInput {
  @IsString()
  @Field(() => ID)
  projectId: string;

  @IsOptional()
  @Field(() => GraphQLUpload)
  file: FileUpload;
}

@InputType()
export class DownloadProjectInput {
  @Field(() => ID)
  @IsUUID()
  projectId: string;

  @Field(() => Boolean, { defaultValue: false, nullable: true })
  @IsBoolean()
  @IsOptional()
  includeNodeModules?: boolean;
}
