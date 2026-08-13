import {
  IsString,
  IsBoolean,
  IsOptional,
  IsArray,
  ArrayMaxSize,
} from 'class-validator';

export class ChatRestDto {
  @IsString()
  chatId: string;

  @IsString()
  message: string;

  @IsString()
  model: string;

  @IsBoolean()
  @IsOptional()
  stream?: boolean = false;

  /** Attached images as `data:<mime>;base64,<data>` URLs. */
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(4)
  @IsOptional()
  images?: string[];

  /**
   * The user's own OpenAI-compatible endpoint, for this turn only. Never
   * logged, never persisted — it lives as long as the request does. Sent per
   * turn rather than stored because storing it would make us a key custodian,
   * which is the part of BYOK worth not building.
   */
  @IsString()
  @IsOptional()
  apiKey?: string;

  @IsString()
  @IsOptional()
  baseUrl?: string;
}
