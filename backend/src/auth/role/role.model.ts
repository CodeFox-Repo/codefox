import { ObjectType, Field, ID } from '@nestjs/graphql';
import { User } from 'src/user/user.model';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  JoinTable,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Menu } from '../menu/menu.model';

@ObjectType('SystemRole')
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

  @Field()
  @Column({ default: true })
  isActive: boolean;

  @Field()
  @Column({ default: false })
  isDeleted: boolean;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;

  @Field(() => [Menu], { nullable: true })
  @ManyToMany(() => Menu, (menu) => menu.roles, { cascade: true })
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

  @Field(() => [User], { nullable: true })
  @ManyToMany(() => User, (user) => user.roles)
  users?: User[];
}
