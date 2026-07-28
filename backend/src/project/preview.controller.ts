import {
  Controller,
  Get,
  Query,
  BadRequestException,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Request, Response } from 'express';
import { JWTAuthGuard } from '../common/guards/jwt-auth.guard';
import { PREVIEW_COOKIE } from './preview-proxy';
import { PreviewService } from './preview.service';
import { Project } from './project.model';
import { assertProjectAccess } from './project-access';

// Booting a dev server costs real memory and the response hands back a cookie
// that proxies the caller into the running app, so an unauthenticated caller
// could both exhaust the box and read a private project's rendered site.
@Controller('api/preview')
@UseGuards(JWTAuthGuard)
export class PreviewController {
  constructor(
    private readonly previewService: PreviewService,
    @InjectRepository(Project)
    private readonly projects: Repository<Project>,
  ) {}

  /**
   * Boot (or reuse) the project's dev server and return where to point the
   * preview iframe. Response shape matches what the web view already expects.
   */
  @Get()
  async preview(
    @Req() req: Request,
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
    // Starting someone else's preview is a write in every sense that matters.
    await assertProjectAccess({
      projects: this.projects,
      req,
      projectPath,
      write: true,
    });

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
  async logs(@Req() req: Request, @Query('projectPath') projectPath: string) {
    if (
      !projectPath ||
      projectPath.includes('/') ||
      projectPath.includes('..')
    ) {
      throw new BadRequestException('Invalid projectPath');
    }
    await assertProjectAccess({
      projects: this.projects,
      req,
      projectPath,
      write: true,
    });
    return { lines: this.previewService.logs(projectPath) };
  }
}
