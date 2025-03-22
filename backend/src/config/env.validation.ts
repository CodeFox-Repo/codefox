import { IsOptional, IsString, IsNumber, IsIn, IsPort } from 'class-validator';

export class EnvironmentVariables {
  // Database Configuration - all optional
  @IsOptional()
  @IsString()
  DB_HOST?: string;

  @IsOptional()
  @IsPort()
  DB_PORT?: string;

  @IsOptional()
  @IsString()
  DB_USERNAME?: string;

  @IsOptional()
  @IsString()
  DB_PASSWORD?: string;

  @IsOptional()
  @IsString()
  DB_DATABASE?: string;

  @IsOptional()
  @IsString()
  DB_REGION?: string;

  @IsOptional()
  @IsString()
  @IsIn(['true', 'false'])
  USE_REMOTE_DB?: string;

  @IsNumber()
  PORT: number = 8000;

  @IsString()
  @IsIn(['DEV', 'PROD', 'TEST'])
  NODE_ENV: string;

  @IsString()
  JWT_SECRET: string;

  @IsString()
  JWT_REFRESH: string;

  @IsNumber()
  SALT_ROUNDS: number;

  @IsString()
  OPENAI_BASE_URI: string;

  // S3/Cloudflare R2 Configuration - all optional
  @IsOptional()
  @IsString()
  S3_ACCESS_KEY_ID?: string;

  @IsOptional()
  @IsString()
  S3_SECRET_ACCESS_KEY?: string;

  @IsOptional()
  @IsString()
  S3_REGION?: string;

  @IsOptional()
  @IsString()
  S3_BUCKET_NAME?: string;

  @IsOptional()
  @IsString()
  S3_ENDPOINT?: string;

  @IsOptional()
  @IsString()
  S3_ACCOUNT_ID?: string;

  @IsOptional()
  @IsString()
  S3_PUBLIC_URL?: string;

  // GitHub Configuration
  @IsOptional()
  @IsString()
  GITHUB_APP_ID?: string;

  @IsOptional()
  @IsString()
  GITHUB_PRIVATE_KEY_PATH?: string;

  @IsOptional()
  @IsString()
  GITHUB_CLIENT_ID?: string;

  @IsOptional()
  @IsString()
  GITHUB_CLIENT_SECRET?: string;

  @IsOptional()
  @IsString()
  GITHUB_WEBHOOK_SECRET?: string;

  // Mail Configuration
  @IsOptional()
  @IsString()
  MAIL_DOMAIN?: string;

  @IsOptional()
  @IsString()
  FRONTEND_URL?: string;

  @IsOptional()
  @IsString()
  MAIL_HOST?: string;

  @IsOptional()
  @IsString()
  MAIL_PORT?: string;

  @IsOptional()
  @IsString()
  MAIL_USER?: string;

  @IsOptional()
  @IsString()
  MAIL_PASSWORD?: string;

  @IsOptional()
  @IsString()
  MAIL_FROM?: string;

  @IsOptional()
  @IsString()
  @IsIn(['true', 'false'])
  MAIL_ENABLED?: string;
}
