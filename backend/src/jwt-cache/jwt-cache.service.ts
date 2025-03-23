import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { Database } from 'sqlite3';

@Injectable()
export class JwtCacheService implements OnModuleInit, OnModuleDestroy {
  private db: Database;
  private readonly logger = new Logger(JwtCacheService.name);
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    this.db = new Database(':memory:');
    this.logger.log('JwtCacheService instantiated with in-memory database');
  }

  async onModuleInit() {
    this.logger.log('Initializing JwtCacheService');
    await this.createTable();
    this.startCleanupTask();
    this.logger.log('JwtCacheService initialized successfully');
  }

  async onModuleDestroy() {
    this.logger.log('Destroying JwtCacheService');
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    await this.closeDatabase();
    this.logger.log('JwtCacheService destroyed successfully');
  }

  private createTable(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `CREATE TABLE IF NOT EXISTS jwt_cache (
          token TEXT PRIMARY KEY,
          created_at INTEGER NOT NULL,
          expires_at INTEGER NOT NULL
        )`,
        (err) => {
          if (err) {
            this.logger.error('Failed to create jwt_cache table', err.stack);
            reject(err);
          } else {
            this.logger.debug('jwt_cache table created successfully');
            resolve();
          }
        },
      );
    });
  }

  private startCleanupTask() {
    const CLEANUP_INTERVAL = 5 * 60 * 1000;
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredTokens().catch((err) =>
        this.logger.error('Failed to cleanup expired tokens', err),
      );
    }, CLEANUP_INTERVAL);
  }

  private cleanupExpiredTokens(): Promise<void> {
    return new Promise((resolve, reject) => {
      const now = Date.now();
      this.db.run(
        'DELETE FROM jwt_cache WHERE expires_at < ?',
        [now],
        (err) => {
          if (err) {
            this.logger.error('Failed to cleanup expired tokens', err.stack);
            reject(err);
          } else {
            resolve();
          }
        },
      );
    });
  }

  private closeDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          this.logger.error('Failed to close database connection', err.stack);
          reject(err);
        } else {
          this.logger.debug('Database connection closed successfully');
          resolve();
        }
      });
    });
  }

  /**
   * The storeAccessToken method stores the access token in the cache dbds
   * @param token the access token
   * @returns return void
   */
  async storeAccessToken(token: string): Promise<void> {
    this.logger.debug(`Storing token: ${token.substring(0, 10)}...`);
    const now = Date.now();
    const expiresAt = now + 24 * 60 * 60 * 1000;

    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT OR REPLACE INTO jwt_cache (token, created_at, expires_at) VALUES (?, ?, ?)',
        [token, now, expiresAt],
        (err) => {
          if (err) {
            this.logger.error('Failed to store token', err.stack);
            reject(err);
          } else {
            resolve();
          }
        },
      );
    });
  }

  async isTokenStored(token: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const now = Date.now();
      this.db.get(
        'SELECT token FROM jwt_cache WHERE token = ? AND expires_at > ?',
        [token, now],
        (err, row) => {
          if (err) {
            this.logger.error('Failed to check token', err.stack);
            reject(err);
          } else {
            resolve(!!row);
          }
        },
      );
    });
  }

  async removeToken(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM jwt_cache WHERE token = ?', [token], (err) => {
        if (err) {
          this.logger.error('Failed to remove token', err.stack);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}
