import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { Database } from 'sqlite3';
import { RefreshToken } from '../auth/refresh-token.model';

@Injectable()
export class JwtCacheService implements OnModuleInit, OnModuleDestroy {
  private db: Database;
  private readonly logger = new Logger(JwtCacheService.name);
  private cleanupInterval: NodeJS.Timeout;

  constructor(
    // Only for the expiry sweep below — this service's own cache is the
    // in-memory sqlite handle, not this table.
    @InjectRepository(RefreshToken)
    private readonly refreshTokens: Repository<RefreshToken>,
  ) {
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
          user_id TEXT,
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
      this.cleanupExpiredRefreshTokens().catch((err) =>
        this.logger.error('Failed to cleanup expired refresh tokens', err),
      );
    }, CLEANUP_INTERVAL);
  }

  /**
   * Drop refresh tokens whose 7 days are up.
   *
   * One row is written per login and deleted only on an explicit logout, so
   * closing the browser, letting a token expire, and every OAuth round trip
   * each leaked a row permanently: measured at 251 rows for 130 users, 200 of
   * them (80%) already past expiry, worst single user 64 rows.
   *
   * ponytail: hung on this service's existing 5-minute sweep rather than
   * adding a scheduler — the interval, its clearInterval and its error
   * handling are already here. Separate catch from the jwt_cache sweep above
   * so a failure in one does not skip the other.
   *
   * No migration needed: the first sweep after deploy reclaims the backlog.
   */
  private async cleanupExpiredRefreshTokens(): Promise<void> {
    const { affected } = await this.refreshTokens.delete({
      expiresAt: LessThan(new Date()),
    });
    if (affected) this.logger.log(`Removed ${affected} expired refresh tokens`);
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
   * @param userId who it was issued to, so every session of one account can
   *   be ended at once (see `removeTokensForUser`)
   * @returns return void
   */
  async storeAccessToken(token: string, userId?: string): Promise<void> {
    this.logger.debug(`Storing token: ${token.substring(0, 10)}...`);
    const now = Date.now();
    const expiresAt = now + 24 * 60 * 60 * 1000;

    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT OR REPLACE INTO jwt_cache (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
        [token, userId ?? null, now, expiresAt],
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

  /**
   * End every session this account has open, right now.
   *
   * The guard admits an access token only while this table still holds it, so
   * deleting the rows is what actually kills them — the JWTs themselves stay
   * signed and valid until they expire, and nothing else consults their
   * signature alone.
   *
   * Returns how many were killed, which is the only way a caller can tell
   * "ended 3 sessions" from "there were none".
   *
   * ponytail: a column on the table that already stores one row per token,
   * not a second userId→timestamp blacklist. Same lookup, no new state to
   * keep consistent, and revocation is a DELETE rather than a comparison on
   * every request.
   */
  async removeTokensForUser(userId: string): Promise<number> {
    if (!userId) return 0;
    return new Promise((resolve, reject) => {
      // `function` so `this.changes` is sqlite3's row count, not the service.
      this.db.run(
        'DELETE FROM jwt_cache WHERE user_id = ?',
        [userId],
        function (err) {
          if (err) reject(err);
          else resolve(this.changes);
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
