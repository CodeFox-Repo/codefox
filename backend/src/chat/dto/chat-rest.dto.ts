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
}
