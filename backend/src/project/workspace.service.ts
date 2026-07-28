import { Injectable } from '@nestjs/common';
import {
  REMOTE_PREVIEW_PORT,
  sandboxHandle,
  sandboxMode,
} from '../chat/sandbox-provider';
import { HostWorkspace } from './host-workspace';
import { PreviewService } from './preview.service';
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
  constructor(private readonly previews: PreviewService) {}

  async for(projectPath: string): Promise<ProjectWorkspace> {
    if (sandboxMode() === 'host') {
      return new HostWorkspace(projectPath, this.previews);
    }

    const sandbox = await sandboxHandle(projectPath);
    return new VercelWorkspace(sandbox, REMOTE_PREVIEW_PORT);
  }
}
