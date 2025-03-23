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
}
