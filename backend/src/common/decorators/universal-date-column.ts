import { CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * Date column options
 */
interface UniversalDateOptions {
  nullable?: boolean;
  update?: boolean;
}

/**
 * Create date column decorator. No explicit `type` — TypeORM maps it per
 * driver (`timestamp` on postgres, `datetime` on sqlite); sqlite has no
 * `timestamp` type and throws if one is forced.
 */
export function UniversalCreateDateColumn(options: UniversalDateOptions = {}) {
  return CreateDateColumn({
    nullable: options.nullable,
    transformer: {
      to: (value: Date) => value,
      from: (value: any) => (value ? new Date(value) : null),
    },
  });
}

/**
 * Update date column decorator. See UniversalCreateDateColumn on `type`.
 */
export function UniversalUpdateDateColumn(options: UniversalDateOptions = {}) {
  return UpdateDateColumn({
    nullable: options.nullable,
    transformer: {
      to: (value: Date) => value,
      from: (value: any) => (value ? new Date(value) : null),
    },
  });
}
