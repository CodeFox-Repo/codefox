import { Module } from '@nestjs/common';
import { UserResolver } from './user.resolver';
import { UserService } from './user.service';
import { DateScalar } from 'src/common/scalar/date.scalar';
import { User } from './user.model';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from 'src/auth/auth.module';
import { MailModule } from 'src/mail/mail.module';
import { UploadModule } from 'src/upload/upload.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    JwtModule,
    AuthModule,
    MailModule,
    UploadModule,
  ],
  providers: [UserResolver, UserService, DateScalar],
  exports: [UserService],
})
export class UserModule {}
