import { Injectable } from '@nestjs/common';
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
