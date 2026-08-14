import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { User } from '../user/user.model';

@Entity()
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  token: string;

  @Column()
  expiresAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  // uuid, like User.id. The column TypeORM actually creates is varchar —
  // it takes the type from the relation above, not from this declaration —
  // so this was typed `number` while holding a uuid, and every delete by
  // userId needed an `as any` to compile. Declaration-only fix: no migration,
  // the column was already varchar.
  @Column()
  userId: string;
}
