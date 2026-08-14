import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  REMOTE_PREVIEW_PORT,
  sandboxHandle,
  sandboxMode,
} from '../chat/sandbox-provider';
import { HostWorkspace } from './host-workspace';
import { PreviewService } from './preview.service';
import { Project } from './project.model';
import { VercelWorkspace } from './vercel-workspace';
import type { ProjectWorkspace } from './workspace';

/**
 * Hands out the workspace for a project, whichever kind this deployment runs.
 *
 * The only place that knows both implementations exist. Callers ask for a
 * project and get something that can list, read, write, preview and archive it
 * — which is what lets the agent move into a real sandbox without the file
 * tree, the editor and the preview all having to be rewritten with it.
 */
@Injectable()
export class WorkspaceService {
  constructor(
    private readonly previews: PreviewService,
    @InjectRepository(Project)
    private readonly projects: Repository<Project>,
  ) {}

  async for(projectPath: string): Promise<ProjectWorkspace> {
    // A project directory is one path segment, always. Checked here rather
    // than at each of the ~20 callers, because this is the chokepoint they
    // all route through and a caller that forgets fails open.
    //
    // HostWorkspace derives `root` as join(projectsDir, projectPath) and then
    // validates every file path *relative to that root* — so a projectPath
    // containing `..` moves the anchor and every later check passes against
    // the escaped directory. `assertProjectAccess` does not cover this: it
    // authorises `projectPath.split('/')[0]`, so "<your-own-project>/../.."
    // passes ownership on its first segment and traverses on the rest.
    // preview.controller.ts had this guard inline; screenshot.controller.ts
    // did not, and reached `file://<anywhere>/index.html` through it.
    if (!projectPath || /[/\\]|^\.+$/.test(projectPath)) {
      throw new BadRequestException('Invalid project path');
    }

    // html projects are a handful of static files; they live on the host in
    // every mode — there is nothing in them that needs a microVM to serve.
    if (sandboxMode() === 'host' || (await this.isHtml(projectPath))) {
      return new HostWorkspace(projectPath, this.previews);
    }

    const sandbox = await sandboxHandle(projectPath);
    return new VercelWorkspace(sandbox, REMOTE_PREVIEW_PORT);
  }

  private async isHtml(projectPath: string): Promise<boolean> {
    const project = await this.projects.findOne({ where: { projectPath } });
    return project?.template === 'html';
  }
}
