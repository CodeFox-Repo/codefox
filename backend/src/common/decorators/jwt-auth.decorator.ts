//function decorator for JWTAuth
import { applyDecorators, UseGuards } from '@nestjs/common';
import { JWTAuthGuard } from 'src/common/guards/jwt-auth.guard';

export function JWTAuth() {
  return applyDecorators(UseGuards(JWTAuthGuard));
}
