import { Field, Float, Int, ObjectType } from '@nestjs/graphql';

/**
 * Read models for the operator console.
 *
 * Separate types rather than reusing Project/User: those are shaped for the
 * product's own screens and carry relations an admin list has no use for,
 * while the numbers an operator needs — disk on the volume, which previews are
 * burning memory right now, what the model provider is set to — live nowhere
 * in the entity graph at all.
 */

@ObjectType()
export class AdminCounts {
  @Field(() => Int) users: number;
  @Field(() => Int) projects: number;
  @Field(() => Int) chats: number;
  /** Rows kept for history. Everything else here counts live records only. */
  @Field(() => Int) deletedProjects: number;
}

@ObjectType()
export class AdminRuntime {
  @Field() nodeEnv: string;
  @Field() model: string;
  @Field() provider: string;
  @Field() sandbox: string;
  @Field() registrationOpen: boolean;
  /** Seconds. Says whether a restart just wiped everyone's session. */
  @Field(() => Int) uptime: number;
}

@ObjectType()
export class AdminDisk {
  /** Bytes under the projects directory — the thing that fills a volume. */
  @Field(() => Float) projectBytes: number;
  @Field(() => Int) projectDirs: number;
  /** Directories on disk with no live project row: leaks, or a failed delete. */
  @Field(() => Int) orphanDirs: number;
}

@ObjectType()
export class AdminPreview {
  @Field() projectPath: string;
  @Field(() => Int) port: number;
  @Field(() => Int) pid: number;
}

@ObjectType()
export class AdminOverview {
  @Field(() => AdminCounts) counts: AdminCounts;
  @Field(() => AdminRuntime) runtime: AdminRuntime;
  @Field(() => AdminDisk) disk: AdminDisk;
  @Field(() => [AdminPreview]) previews: AdminPreview[];
}

@ObjectType()
export class AdminUser {
  @Field() id: string;
  @Field() email: string;
  @Field() username: string;
  @Field() isActive: boolean;
  @Field(() => [String]) roles: string[];
  @Field(() => Int) projects: number;
  @Field(() => Int) chats: number;
  @Field() createdAt: Date;
}

@ObjectType()
export class AdminProject {
  @Field() id: string;
  @Field() projectName: string;
  @Field() projectPath: string;
  @Field() isPublic: boolean;
  @Field() ownerEmail: string;
  @Field(() => Int) chats: number;
  /** False when the row outlived its directory — the project cannot open. */
  @Field() onDisk: boolean;
  @Field() createdAt: Date;
}
