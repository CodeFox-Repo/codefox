import { IsOptional, IsString, IsNumber, IsIn } from 'class-validator';

export class EnvironmentVariables {
  // Database Configuration. Unset => SQLite file under .codefox/data.
  @IsOptional()
  @IsString()
  DATABASE_URL?: string;

  @IsNumber()
  PORT: number = 8000;

  /**
   * Both spellings are accepted. The validator used to allow only DEV/PROD/
   * TEST while every runtime check compares against 'production', so PROD
   * booted with development settings and 'production' failed validation
   * outright — production was unreachable either way.
   */
  @IsString()
  @IsIn(['development', 'production', 'test', 'DEV', 'PROD', 'TEST'])
  NODE_ENV: string;

  @IsString()
  JWT_SECRET: string;

  @IsString()
  JWT_REFRESH: string;

  @IsNumber()
  SALT_ROUNDS: number;

  // LLM backend — any OpenAI-compatible endpoint. All optional; unset falls
  // back to OpenRouter via OPENROUTER_API_KEY.
  @IsOptional()
  @IsString()
  LLM_BASE_URL?: string;

  @IsOptional()
  @IsString()
  LLM_API_KEY?: string;

  @IsOptional()
  @IsString()
  LLM_MODELS?: string;

  @IsOptional()
  @IsString()
  LLM_DEFAULT_MODEL?: string;

  @IsOptional()
  @IsString()
  OPENROUTER_API_KEY?: string;

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
  @IsIn(['true', 'false'])
  GITHUB_ENABLED?: string;

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
