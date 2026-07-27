import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { PreviewService } from './preview.service';

@Controller('api/preview')
export class PreviewController {
  constructor(private readonly previewService: PreviewService) {}

  /**
   * Boot (or reuse) the project's dev server and return where to point the
   * preview iframe. Response shape matches what the web view already expects.
   */
  @Get()
  async preview(@Query('projectPath') projectPath: string) {
    if (!projectPath || projectPath.includes('/') || projectPath.includes('..')) {
      throw new BadRequestException('Invalid projectPath');
    }

    const { port } = await this.previewService.start(projectPath);
    return { domain: `127.0.0.1:${port}`, containerId: `local-${projectPath}` };
  }
}
