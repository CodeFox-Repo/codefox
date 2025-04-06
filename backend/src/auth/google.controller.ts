import { Controller, Get, Logger, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';

@Controller('auth')
export class GoogleController {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {}

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
    // This route initiates the Google OAuth flow
    // The guard redirects to Google
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthCallback(@Req() req, @Res() res) {
    Logger.log('Google callback');
    const googleProfile = req.user as {
      googleId: string;
      email: string;
      firstName?: string;
      lastName?: string;
    };

    // Call the AuthService method
    const { accessToken, refreshToken } =
      await this.authService.handleGoogleCallback(googleProfile);

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';

    // TO DO IS UNSAFE
    // Redirect to frontend, pass tokens in query params
    return res.redirect(
      `${frontendUrl}/auth/oauth-callback?accessToken=${accessToken}&refreshToken=${refreshToken}`,
    );
  }
}
