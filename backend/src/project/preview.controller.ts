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
import { sandboxMode } from '../chat/sandbox-provider';
import { WorkspaceService } from './workspace.service';

// Booting a dev server costs real memory and the response hands back a cookie
// that proxies the caller into the running app, so an unauthenticated caller
// could both exhaust the box and read a private project's rendered site.
@Controller('api/preview')
@UseGuards(JWTAuthGuard)
export class PreviewController {
  constructor(
    private readonly workspaces: WorkspaceService,
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

    const workspace = await this.workspaces.for(projectPath);
    const { url } = await workspace.startPreview();

    // Only the host needs the cookie. There a dev server binds to loopback —
    // this machine, not the visitor's — so the iframe is pointed back at this
    // origin and the proxy uses the cookie to decide whose project to serve.
    // A sandbox publishes its own address and is reached directly.
    if (sandboxMode() === 'host') {
      // SameSite=None because the frontend is served from another domain, so
      // the iframe request is cross-site.
      res.cookie(PREVIEW_COOKIE, projectPath, {
        httpOnly: true,
        sameSite: 'none',
        secure: true,
        path: '/',
      });
    }

    return {
      domain: url.replace(/^https?:\/\//, ''),
      containerId: `${sandboxMode()}-${projectPath}`,
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
    const workspace = await this.workspaces.for(projectPath);
    return { lines: await workspace.previewLogs() };
  }
}
