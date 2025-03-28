import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { EnvironmentVariables } from './env.validation';

@Injectable()
export class AppConfigService {
  constructor(private configService: NestConfigService<EnvironmentVariables>) {}

  /**
   * Get server port from environment
   */
  get port(): number {
    return this.configService.get('PORT');
  }

  /**
   * Get JWT secret key for token generation
   */
  get jwtSecret(): string {
    return this.configService.get('JWT_SECRET');
  }

  /**
   * Get JWT refresh token secret
   */
  get jwtRefresh(): string {
    return this.configService.get('JWT_REFRESH');
  }

  /**
   * Get password hashing salt rounds
   */
  get saltRounds(): number {
    return this.configService.get('SALT_ROUNDS');
  }

  /**
   * Get OpenAI API base URI
   */
  get openaiBaseUri(): string {
    return this.configService.get('OPENAI_BASE_URI');
  }

  /**
   * Get S3/Cloudflare R2 configuration object
   */
  get s3Config() {
    return {
      accessKeyId: this.configService.get('S3_ACCESS_KEY_ID'),
      secretAccessKey: this.configService.get('S3_SECRET_ACCESS_KEY'),
      region: this.configService.get('S3_REGION'),
      bucketName: this.configService.get('S3_BUCKET_NAME'),
      endpoint: this.configService.get('S3_ENDPOINT'),
      accountId: this.configService.get('S3_ACCOUNT_ID'),
      publicUrl: this.configService.get('S3_PUBLIC_URL'),
    };
  }

  /**
   * Check if S3 storage is properly configured
   */
  get hasS3Configured(): boolean {
    const config = this.s3Config;
    return !!(
      config.accessKeyId &&
      config.secretAccessKey &&
      config.region &&
      (config.endpoint || config.accountId)
    );
  }

  /**
   * Check if production environment
   */
  get isProduction(): boolean {
    return this.configService.get('NODE_ENV') === 'production';
  }

  /**
   * Check if development environment
   */
  get isDevEnv(): boolean {
    const env = this.configService.get('NODE_ENV');
    return env?.toUpperCase() === 'DEV';
  }

  /**
   * Check if using remote database
   */
  get useRemoteDb(): boolean {
    return this.configService.get('USE_REMOTE_DB') === 'true';
  }

  /**
   * Get database configuration
   */
  get dbConfig() {
    return {
      host: this.configService.get('DB_HOST'),
      port: parseInt(this.configService.get('DB_PORT'), 10),
      username: this.configService.get('DB_USERNAME'),
      password: this.configService.get('DB_PASSWORD'),
      database: this.configService.get('DB_DATABASE') || 'postgres',
      region: this.configService.get('DB_REGION'),
    };
  }

  /**
   * Get GitHub configuration
   */
  get githubConfig() {
    return {
      appId: this.configService.get('GITHUB_APP_ID'),
      privateKeyPath: this.configService.get('GITHUB_PRIVATE_KEY_PATH'),
      clientId: this.configService.get('GITHUB_CLIENT_ID'),
      clientSecret: this.configService.get('GITHUB_CLIENT_SECRET'),
      webhookSecret: this.configService.get('GITHUB_WEBHOOK_SECRET'),
      enabled: !!this.configService.get('GITHUB_ENABLED'),
    };
  }

  get githubEnabled(): boolean {
    return this.configService.get('GITHUB_ENABLED') === 'true';
  }

  get githubWebhookSecret(): string {
    return this.configService.get('GITHUB_WEBHOOK_SECRET');
  }

  /**
   * Get mail domain for email links
   */
  get mailDomain(): string {
    return this.configService.get('MAIL_DOMAIN');
  }

  /**
   * Get frontend URL for email links
   */
  get frontendUrl(): string {
    return this.configService.get('FRONTEND_URL');
  }

  /**
   * Get mail configuration
   */
  get mailConfig() {
    return {
      host: this.configService.get('MAIL_HOST'),
      port: parseInt(this.configService.get('MAIL_PORT'), 10),
      user: this.configService.get('MAIL_USER'),
      password: this.configService.get('MAIL_PASSWORD'),
      from: this.configService.get('MAIL_FROM'),
    };
  }

  /**
   * Check if mail service is enabled
   */
  get isMailEnabled(): boolean {
    return (
      this.configService.get('MAIL_ENABLED', 'false').toLowerCase() === 'true'
    );
  }

  get githubAppId(): string {
    return this.configService.get('GITHUB_APP_ID');
  }

  get githubPrivateKeyPath(): string {
    return this.configService.get('GITHUB_PRIVATE_KEY_PATH');
  }

  get githubClientId(): string {
    return this.configService.get('GITHUB_CLIENT_ID');
  }

  get githubClientSecret(): string {
    return this.configService.get('GITHUB_CLIENT_SECRET');
  }
}
