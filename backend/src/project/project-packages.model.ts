import { ObjectType, Field, ID } from '@nestjs/graphql';
import { SystemBaseModel } from 'src/common/models/system-base.model';
import { Entity, PrimaryGeneratedColumn, Column, ManyToMany } from 'typeorm';
import { Project } from './project.model';

@Entity()
@ObjectType()
export class ProjectPackages extends SystemBaseModel {
  @Field(() => ID)
  @PrimaryGeneratedColumn()
  id: string;

  @Field()
  @Column({ nullable: false })
  name: string;

  @Field()
  @Column('text')
  content: string;

  @Field()
  @Column()
  version: string;

  @ManyToMany(() => Project, (project) => project.projectPackages, {
    nullable: true,
  })
  projects: Project[];
}
