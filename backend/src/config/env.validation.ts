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
}
