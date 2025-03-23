import { ObjectType, Field, ID } from '@nestjs/graphql';
import { SystemBaseModel } from 'src/system-base-model/system-base.model';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  ManyToMany,
  JoinTable,
  OneToMany,
  RelationId,
} from 'typeorm';
import { User } from 'src/user/user.model';
import { ProjectPackages } from './project-packages.model';
import { Chat } from 'src/chat/chat.model';

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

  @Field(() => ID)
  @RelationId((project: Project) => project.user)
  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, (user) => user.projects, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'user_id' })
  @Field(() => User)
  user: User;

  @Field(() => [ProjectPackages], { nullable: true })
  @ManyToMany(
    () => ProjectPackages,
    (projectPackage) => projectPackage.projects,
  )
  @JoinTable({
    name: 'project_packages_mapping',
    joinColumn: {
      name: 'project_id',
      referencedColumnName: 'id',
    },
    inverseJoinColumn: {
      name: 'package_id',
      referencedColumnName: 'id',
    },
  })
  projectPackages: ProjectPackages[];

  @Field(() => [Chat])
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
  @Field()
  @Column({ unique: true, default: () => 'uuid_generate_v4()' })
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
