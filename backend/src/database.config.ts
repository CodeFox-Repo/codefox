import { join } from 'path';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { AppConfigService } from './config/config.service';

/**
 * PostgreSQL database configuration
 * SQLite support has been removed - use PostgreSQL only
 */
export async function getDatabaseConfig(
  config: AppConfigService,
): Promise<TypeOrmModuleOptions> {
  const entities = [join(__dirname, '**', '*.model.{ts,js}')];

  return {
    type: 'postgres',
    url: config.databaseUrl,
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
