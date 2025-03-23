import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { join } from 'path';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/user/user.model';
import { JwtModule } from '@nestjs/jwt';
import { AppConfigService } from 'src/config/config.service';
import { AppConfigModule } from 'src/config/config.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([User]),
    AppConfigModule,
    MailerModule.forRootAsync({
      imports: [AppConfigModule],
      useFactory: async (config: AppConfigService) => {
        const mailConfig = config.mailConfig;
        return {
          transport: {
            host: mailConfig.host,
            port: mailConfig.port,
            secure: false,
            auth: {
              user: mailConfig.user,
              pass: mailConfig.password,
            },
          },
          defaults: {
            from: `"Your App" <${mailConfig.from}>`,
          },
          template: {
            dir: join(__dirname, 'templates'),
            adapter: new HandlebarsAdapter(),
            options: {
              strict: true,
            },
          },
        };
      },
      inject: [AppConfigService],
    }),
    JwtModule,
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
