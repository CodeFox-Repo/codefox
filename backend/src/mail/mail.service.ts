import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/user/user.model';
import { Repository } from 'typeorm';
import { AppConfigService } from 'src/config/config.service';

@Injectable()
export class MailService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private readonly mailerService: MailerService,
    private configService: AppConfigService,
  ) {}

  async sendConfirmationEmail(email: string, token: string) {
    const confirmUrl = `https://${this.configService.mailDomain}/auth/confirm?token=${token}`;

    await this.mailerService.sendMail({
      to: email,
      subject: 'Confirm Your Email',
      template: './confirmation',
      context: { confirmUrl }, // Data for template
    });
  }

  async sendPasswordResetEmail(user: User, token: string) {
    const frontendUrl = this.configService.frontendUrl;
    const url = `${frontendUrl}/reset-password?token=${token}`;

    await this.mailerService.sendMail({
      to: user.email,
      subject: 'Password Reset Request',
      template: './passwordReset',
      context: {
        name: user.username,
        firstName: user.username,
        url,
      },
    });
  }

  // async sendConfirmationEmail(user: User, token: string) {
  //   const frontendUrl = this.configService.get('FRONTEND_URL');
  //   const url = `${frontendUrl}/confirm-email?token=${token}`;

  //   await this.mailerService.sendMail({
  //     to: user.email,
  //     subject: 'Welcome! Confirm Your Email',
  //     template: './confirmation', // This will use the confirmation.hbs template
  //     context: { // Data to be sent to the template
  //       name: user.username,
  //       firstName: user.firstName || user.username,
  //       url,
  //     },
  //   });
  // }
}
