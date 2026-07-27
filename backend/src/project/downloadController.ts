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

    const fileStream = fs.createReadStream(zipPath);
    fileStream.pipe(response);

    fileStream.on('end', () => {
      fs.unlink(zipPath, (err) => {
        if (err) {
          this.logger.error(`Error deleting zip file: ${err.message}`);
        }
      });
    });
  }
}
