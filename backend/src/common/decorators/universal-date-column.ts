import { CreateDateColumn, UpdateDateColumn, ColumnType } from 'typeorm';

/**
 * Universal date column options
 */
interface UniversalDateOptions {
  nullable?: boolean;
  update?: boolean;
}

/**
 * Get database column type based on environment
 * @returns 'timestamp' for remote database, 'datetime' for local
 */
function getDateColumnType(): ColumnType {
  // FIXME: optimize this logic to use a config file or environment variable
  // const useRemoteDb = process.env.USE_REMOTE_DB === 'true';
  // use timestamp for remote database
  return 'datetime' as ColumnType;
}

/**
 * Universal create date column decorator that handles both remote and local databases
 */
export function UniversalCreateDateColumn(options: UniversalDateOptions = {}) {
  return CreateDateColumn({
    type: getDateColumnType(),
    nullable: options.nullable,
    transformer: {
      to: (value: Date) => value,
      from: (value: any) => (value ? new Date(value) : null),
    },
  });
}

/**
 * Universal update date column decorator that handles both remote and local databases
 */
export function UniversalUpdateDateColumn(options: UniversalDateOptions = {}) {
  return UpdateDateColumn({
    type: getDateColumnType(),
    nullable: options.nullable,
    transformer: {
      to: (value: Date) => value,
      from: (value: any) => (value ? new Date(value) : null),
    },
  });
}
