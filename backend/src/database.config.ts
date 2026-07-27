import { join } from 'path';
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
 */
export async function getDatabaseConfig(
  config: AppConfigService,
): Promise<TypeOrmModuleOptions> {
  const entities = [join(__dirname, '**', '*.model.{ts,js}')];
  const url = config.databaseUrl;

  if (!url || !/^postgres(ql)?:\/\//.test(url)) {
    return {
      type: 'sqlite',
      database: url?.replace(/^sqlite:(\/\/)?/, '') || getDatabasePath(),
      synchronize: !config.isProduction,
      entities,
      logging: !config.isProduction,
    } as TypeOrmModuleOptions;
  }

  return {
    type: 'postgres',
    url,
    synchronize: !config.isProduction, // auto sync for dev only
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
