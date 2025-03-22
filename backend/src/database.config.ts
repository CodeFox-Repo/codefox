import { join } from 'path';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { AppConfigService } from './config/config.service';

export async function getDatabaseConfig(
  config: AppConfigService,
): Promise<TypeOrmModuleOptions> {
  const entities = [join(__dirname, '**', '*.model.{ts,js}')];

  // Use SQLite for local development
  if (!config.useRemoteDb) {
    return {
      type: 'sqlite',
      database: join(process.cwd(), './database.db'),
      synchronize: false,
      entities,
      migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
      migrationsRun: true,
      logging: !config.isProduction,
    };
  }

  const dbConfig = config.dbConfig;
  return {
    type: 'postgres',
    ...dbConfig,
    synchronize: false,
    entities,
    migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
    migrationsRun: true,
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
