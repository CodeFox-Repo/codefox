import { Controller, Get, Logger, Param, Res, UseGuards } from '@nestjs/common';
import { ProjectService } from 'src/project/project.service';
import { GetUserIdFromToken } from 'src/common/decorators/get-auth-token.decorator';
import { JWTAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { Response } from 'express';
import * as fs from 'fs';

// The guard is what notices a token that logout has already invalidated; the
// decorator alone only proves the signature is ours.
@Controller('download')
@UseGuards(JWTAuthGuard)
export class DownloadController {
  private readonly logger = new Logger('DownloadController');
  constructor(private readonly projectService: ProjectService) {}

  @Get('project/:projectId')
  async downloadProject(
    @GetUserIdFromToken() userId: string,
    @Param('projectId') projectId: string,
    @Res() response: Response,
  ) {
    this.logger.log(`User ${userId} downloading project ${projectId}`);

    const { zipPath, fileName } = await this.projectService.createProjectZip(
      userId,
      projectId,
    );

    response.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    });

    // The zip is a temp file for this one response, so it goes away however
    // the stream ends — 'close' fires on completion and on a client that
    // disconnects halfway, which 'end' alone missed, leaving the file forever.
    const cleanup = () =>
      fs.promises
        .unlink(zipPath)
        .catch((err) => this.logger.warn(`Could not remove ${zipPath}: ${err}`));

    fs.createReadStream(zipPath).on('close', cleanup).pipe(response);
  }
}
