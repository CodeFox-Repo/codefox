import { CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * Date column options for PostgreSQL
 */
interface UniversalDateOptions {
  nullable?: boolean;
  update?: boolean;
}

/**
 * Create date column decorator for PostgreSQL
 */
export function UniversalCreateDateColumn(options: UniversalDateOptions = {}) {
  return CreateDateColumn({
    type: 'timestamp',
    nullable: options.nullable,
    transformer: {
      to: (value: Date) => value,
      from: (value: any) => (value ? new Date(value) : null),
    },
  });
}

/**
 * Update date column decorator for PostgreSQL
 */
export function UniversalUpdateDateColumn(options: UniversalDateOptions = {}) {
  return UpdateDateColumn({
    type: 'timestamp',
    nullable: options.nullable,
    transformer: {
      to: (value: Date) => value,
      from: (value: any) => (value ? new Date(value) : null),
    },
  });
}
