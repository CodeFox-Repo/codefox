import {
  Controller,
  Get,
  Logger,
  NotFoundException,
  Param,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Public } from '../common/decorators/public.decorator';
import { Project } from './project.model';
import { WorkspaceService } from './workspace.service';

/**
 * Boots a public Next project and hands back where it is reachable.
 *
 * The gallery's share links serve html pages as files; an app has no file to
 * serve — it has a dev server. This endpoint is the bridge: anyone with the
 * link may boot the app's sandbox and get its public address. Bounded to
 * projects the owner marked public; everything else is indistinguishable from
 * nonexistent, same rule as /share.
 *
 * Boots are deduped per project: a cold sandbox takes up to a minute, and
 * without this a wall of curious clicks each started their own `next dev`.
 */
@Controller('api/live')
export class LiveController {
  private readonly logger = new Logger('LiveController');
  /** projectPath -> in-flight boot. */
  private static readonly boots = new Map<string, Promise<string>>();

  constructor(
    @InjectRepository(Project)
    private readonly projects: Repository<Project>,
    private readonly workspaces: WorkspaceService,
  ) {}

  @Get(':id')
  @Public()
  async live(@Param('id') id: string): Promise<{ url: string }> {
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      throw new NotFoundException('Not a live link');
    }
    const project = await this.projects.findOne({
      where: { uniqueProjectId: id, isDeleted: false },
    });
    // One answer for "no such project", "private" and "is a page" — see /share.
    if (!project?.isPublic || project.template === 'html') {
      throw new NotFoundException('Not a live link');
    }

    const running = LiveController.boots.get(project.projectPath);
    if (running) return { url: await running };

    const boot = (async () => {
      const workspace = await this.workspaces.for(project.projectPath);
      const { url } = await workspace.startPreview();
      return url;
    })();
    LiveController.boots.set(project.projectPath, boot);
    try {
      return { url: await boot };
    } finally {
      LiveController.boots.delete(project.projectPath);
    }
  }
}
