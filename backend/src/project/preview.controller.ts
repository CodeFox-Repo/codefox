import {
  Controller,
  Get,
  Query,
  BadRequestException,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { PREVIEW_COOKIE } from './preview-proxy';
import { PreviewService } from './preview.service';

@Controller('api/preview')
export class PreviewController {
  constructor(private readonly previewService: PreviewService) {}

  /**
   * Boot (or reuse) the project's dev server and return where to point the
   * preview iframe. Response shape matches what the web view already expects.
   */
  @Get()
  async preview(
    @Query('projectPath') projectPath: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (
      !projectPath ||
      projectPath.includes('/') ||
      projectPath.includes('..')
    ) {
      throw new BadRequestException('Invalid projectPath');
    }

    const { port } = await this.previewService.start(projectPath);

    // A dev server binds to loopback, which is this machine — handing that
    // address to a browser only works when they are the same machine. Point
    // the iframe at this origin instead and let the cookie say which project
    // the proxy should serve. SameSite=None because the frontend is served
    // from another domain, so the iframe request is cross-site.
    res.cookie(PREVIEW_COOKIE, projectPath, {
      httpOnly: true,
      sameSite: 'none',
      secure: true,
      path: '/',
    });

    const publicOrigin = process.env.PUBLIC_ORIGIN;
    return {
      domain: publicOrigin
        ? publicOrigin.replace(/^https?:\/\//, '')
        : `127.0.0.1:${port}`,
      containerId: `local-${projectPath}`,
    };
  }

  /** Dev-server output. Does not start a server — reports on a running one. */
  @Get('logs')
  logs(@Query('projectPath') projectPath: string) {
    if (
      !projectPath ||
      projectPath.includes('/') ||
      projectPath.includes('..')
    ) {
      throw new BadRequestException('Invalid projectPath');
    }
    return { lines: this.previewService.logs(projectPath) };
  }
}
