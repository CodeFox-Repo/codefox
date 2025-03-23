// src/auth/dto/resend-email.input.ts
import { InputType, Field } from '@nestjs/graphql';
import { IsEmail, IsNotEmpty } from 'class-validator';

@InputType()
export class ResendEmailInput {
  @Field()
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
