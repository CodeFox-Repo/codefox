import { Field, ObjectType } from '@nestjs/graphql';
import { Column } from 'typeorm';
import {
  UniversalCreateDateColumn,
  UniversalUpdateDateColumn,
} from '../common/decorators/universal-date-column';

@ObjectType()
export class SystemBaseModel {
  @Field()
  @UniversalCreateDateColumn()
  createdAt: Date;

  @Field()
  @UniversalUpdateDateColumn()
  updatedAt: Date;

  @Field()
  @Column({ default: true })
  isActive: boolean;

  @Field()
  @Column({ default: false })
  isDeleted: boolean;
}
