import { ObjectType, Field, ID } from '@nestjs/graphql';
import { User } from 'src/user/user.model';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { Menu } from '../menu/menu.model';

@ObjectType()
@Entity()
export class Role {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column({ unique: true })
  name: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  description?: string;

  @Field(() => [Menu], { nullable: true })
  @ManyToMany(() => Menu, { eager: true })
  @JoinTable({
    name: 'role_menus',
    joinColumn: {
      name: 'role_id',
      referencedColumnName: 'id',
    },
    inverseJoinColumn: {
      name: 'menu_id',
      referencedColumnName: 'id',
    },
  })
  menus?: Menu[];

  @ManyToMany(() => User, (user) => user.roles)
  users?: User[];
}
