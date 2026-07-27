import { ObjectType, Field, ID } from '@nestjs/graphql';
import { SystemBaseModel } from 'src/common/models/system-base.model';
import { Entity, PrimaryGeneratedColumn, Column, ManyToMany } from 'typeorm';
import { Role } from './role.model';

@Entity()
@ObjectType()
export class Menu extends SystemBaseModel {
  @Field(() => ID)
  @PrimaryGeneratedColumn()
  id: string;

  @Field()
  @Column()
  name: string;

  @Field()
  @Column()
  path: string;

  @Field()
  @Column()
  permission: string;

  @ManyToMany(() => Role, (role) => role.menus)
  roles: Role[];
}
