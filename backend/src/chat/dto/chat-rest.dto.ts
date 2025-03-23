import { IsString, IsBoolean, IsOptional } from 'class-validator';

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
}
