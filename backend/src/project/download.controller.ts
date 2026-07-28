import * as fs from 'fs';
import { Controller, Get, Logger, Param, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { JWTAuthGuard } from '../common/guards/jwt-auth.guard';
import { ProjectService } from './project.service';

/**
 * Hands a project back as a zip.
 *
 * The service side of this survived a refactor that took the controller with
 * it, so the toolbar's Download button has been calling a route that does not
 * exist. The path matches what the frontend already asks for.
 */
@Controller('download')
@UseGuards(JWTAuthGuard)
export class DownloadController {
  private readonly logger = new Logger('DownloadController');

  constructor(private readonly projectService: ProjectService) {}

  @Get('project/:projectId')
  async downloadProject(
    @Req() req: Request,
    @Param('projectId') projectId: string,
    @Res() res: Response,
  ) {
    // The guard has already verified the signature and put the payload here;
    // decoding the header again would trust whatever the caller sent.
    const userId = (req as any).user?.userId;
    this.logger.log(`User ${userId} downloading project ${projectId}`);

    const { zipPath, fileName } = await this.projectService.createProjectZip(
      userId,
      projectId,
    );

    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    });

    // The zip is a temp file for this one response, so it goes away however
    // the stream ends — a client that disconnects halfway would otherwise
    // leave it behind forever.
    const cleanup = () =>
      fs.promises
        .unlink(zipPath)
        .catch((error) => this.logger.warn(`Could not remove ${zipPath}: ${error}`));

    fs.createReadStream(zipPath).on('close', cleanup).pipe(res);
  }
}
