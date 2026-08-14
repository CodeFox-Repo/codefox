import { ObjectType, Field, ID } from '@nestjs/graphql';
import { SystemBaseModel } from 'src/common/models/system-base.model';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  RelationId,
} from 'typeorm';
import { User } from 'src/user/user.model';
import { Chat } from 'src/chat/chat.model';
import { Byline } from './byline.model';

@Entity()
@ObjectType()
export class Project extends SystemBaseModel {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column()
  projectName: string;

  @Field()
  @Column()
  projectPath: string;

  /**
   * What kind of workspace this is. 'html' — a handful of self-contained
   * HTML files, previewed by rendering them directly, no toolchain at all.
   * 'next' (and null, for older rows) — the full Next.js starter with a dev
   * server. Open-design's insight: most generated sites need no template.
   */
  @Field({ nullable: true })
  @Column({ nullable: true })
  template: string | null;

  @Field(() => ID)
  @RelationId((project: Project) => project.user)
  @Column({ name: 'user_id' })
  userId: string;

  /**
   * The byline on a gallery card. Typed as `Byline`, not `User`.
   *
   * This field hangs off the @Public `fetchPublicProjects`, and nothing
   * guards a field resolver (APP_GUARD does not reach them without
   * `fieldResolverEnhancers`, which is unset) — so every field the returned
   * TYPE advertises is anonymously readable, whatever the resolver hands
   * back. Typed as `User` it published each publisher's email as a scrapable
   * list, plus isEmailConfirmed, lastEmailSendTime and githubInstallationId.
   * Narrowing the resolver alone did not fix that: the schema still offered
   * the fields, so `user { email }` still resolved off the entity.
   *
   * A type with only the three things a card renders has nothing left to
   * leak. `me` (guarded) is how anyone reads their own account.
   */
  @ManyToOne(() => User, (user) => user.projects, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'user_id' })
  @Field(() => Byline)
  user: User;

  // Deliberately NOT a @Field, like User.chats and User.roles: `Project` is
  // what the @Public `fetchPublicProjects` returns, and field resolvers run
  // with no guard (APP_GUARD does not reach them without
  // `fieldResolverEnhancers`, which is unset). As a field, a project's whole
  // build conversation — every message, and via Chat.user its owner's account
  // — was readable by anyone with the gallery's project ids. Nothing selected
  // it; guarded `getChatDetails` / `getChatHistory` are how a client reads a
  // chat.
  @OneToMany(() => Chat, (chat) => chat.project, {
    cascade: true, // Automatically save related chats
    lazy: true, // Load chats only when accessed
    onDelete: 'CASCADE', // Delete chats when project is deleted
  })
  chats: Promise<Chat[]>;

  /**
   * Represents whether the project is public or private
   */
  @Field()
  @Column({ default: false })
  isPublic: boolean;

  /**
   * Counts the number of times this project has been subscribed to (copied)
   */
  @Field()
  @Column({ default: 0 })
  subNumber: number;

  /**
   * The URL to the project's screenshot or thumbnail
   */
  @Field({ nullable: true })
  @Column({ nullable: true })
  photoUrl: string;

  /**
   * The name of the repo in GitHub (e.g. "my-cool-project").
   */
  @Field({ nullable: true })
  @Column({ nullable: true })
  githubRepoName?: string;

  /**
   * The GitHub HTML URL for this repo (e.g. "https://github.com/username/my-cool-project").
   */
  @Field({ nullable: true })
  @Column({ nullable: true })
  githubRepoUrl?: string;

  /**
   * The GitHub username or organization name that owns the repo.
   */
  @Field({ nullable: true })
  @Column({ nullable: true })
  githubOwner?: string;

  /**
   * Whether this project has been synced/pushed to GitHub.
   */
  @Field()
  @Column({ default: false })
  isSyncedWithGitHub: boolean;

  /**
   * Unique identifier for tracking project lineage
   * Used to track which projects are copies of others
   */
  // No DB-level default: uuid_generate_v4() is a postgres extension function
  // that sqlite lacks, and every creation path in ProjectService already
  // assigns this explicitly.
  @Field()
  @Column({ unique: true })
  uniqueProjectId: string;

  /**
   * If this project is a copy/fork, stores the uniqueProjectId of the original project.
   * Projects with forkedFromId are fully editable by their new owner while maintaining
   * a reference to the original project they were copied from.
   */
  @Field({ nullable: true })
  @Column({ nullable: true })
  forkedFromId: string;

  /**
   * Reference to the original project if this is a copy/fork
   */
  @Field(() => Project, { nullable: true })
  @ManyToOne(() => Project, (project) => project.forks, { nullable: true })
  @JoinColumn({ name: 'forkedFromId', referencedColumnName: 'uniqueProjectId' })
  forkedFrom: Project;

  /**
   * Projects that were copied from this project
   */
  @Field(() => [Project], { nullable: true })
  @OneToMany(() => Project, (project) => project.forkedFrom)
  forks: Project[];

  /**
   * Projects copied from this one
   * Maintained for backwards compatibility, same as forks
   */
  @Field(() => [Project], {
    nullable: true,
    description: 'Projects that are copies of this project',
  })
  @OneToMany(() => Project, (project) => project.forkedFrom)
  subscribers: Project[];
}
