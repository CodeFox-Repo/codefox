import { join } from 'path';
import { Logger } from '@nestjs/common';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { AppConfigService } from './config/config.service';
import { getDatabasePath } from './common/utils/common-path';

/**
 * Database configuration, picked from DATABASE_URL:
 *   postgres://... | postgresql://...  -> PostgreSQL
 *   anything else / unset             -> SQLite file under .codefox/data
 *
 * SQLite is the zero-setup default so `pnpm dev` works with no external
 * services. Production is expected to set a postgres URL.
 *
 * Schema: TypeORM only auto-creates tables when `synchronize` is on, and this
 * repo carries no migrations. With `synchronize` hard-wired off in production
 * a fresh deploy came up against an empty database and every query failed, so
 * the first boot needs DB_SYNCHRONIZE=true to create the schema. Turn it off
 * again once there is data worth protecting — synchronize will happily drop a
 * column to match an entity.
 */
export async function getDatabaseConfig(
  config: AppConfigService,
): Promise<TypeOrmModuleOptions> {
  const entities = [join(__dirname, '**', '*.model.{ts,js}')];
  const url = config.databaseUrl;

  const synchronize = config.isProduction
    ? process.env.DB_SYNCHRONIZE === 'true'
    : true;

  if (config.isProduction && synchronize) {
    new Logger('Database').warn(
      'DB_SYNCHRONIZE=true in production: TypeORM will alter the schema to ' +
        'match the entities on boot. Intended for the first deploy only.',
    );
  }

  if (!url || !/^postgres(ql)?:\/\//.test(url)) {
    return {
      type: 'sqlite',
      database: url?.replace(/^sqlite:(\/\/)?/, '') || getDatabasePath(),
      synchronize,
      entities,
      logging: !config.isProduction,
    } as TypeOrmModuleOptions;
  }

  return {
    type: 'postgres',
    url,
    synchronize,
    entities,
    logging: !config.isProduction,
    poolSize: config.isProduction ? 50 : 20,
    connectTimeoutMS: 10000,
    extra: {
      max: config.isProduction ? 50 : 20,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 60000,
    },
    retryAttempts: 3,
    retryDelay: 3000,
    keepConnectionAlive: true,
  } as TypeOrmModuleOptions;
}
