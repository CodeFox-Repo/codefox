import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  Post,
  Body,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Request, Response } from 'express';
import { JWTAuthGuard } from '../common/guards/jwt-auth.guard';
import { getMediaDir } from '../common/utils/common-path';
import { Project } from './project.model';
import { assertProjectAccess } from './project-access';
import { WorkspaceService } from './workspace.service';
import { designSystem, DESIGN_SYSTEMS, swapTokens } from './design-systems';

/**
 * Reads and writes the files of a generated project.
 *
 * These used to be Next.js route handlers, which worked only because the two
 * halves shared a disk. Split across hosts the frontend's copy reads an empty
 * filesystem, so the file tree never loads and the editor cannot save. They
 * belong wherever the projects actually live — and when the agent moves into a
 * remote sandbox, this is the one place that has to learn to read from it.
 *
 * The frontend still calls `/api/project` and `/api/file`; its rewrite
 * forwards anything under `/api` here once the local handlers are gone.
 */

interface TreeItem {
  index: string;
  data: string;
  isFolder: boolean;
  canMove: boolean;
  canRename: boolean;
  children: string[];
}

const emptyTree = () => ({
  root: {
    index: 'root',
    isFolder: true,
    children: [] as string[],
    data: 'Root',
    canMove: false,
    canRename: false,
  },
});

/**
 * Folders first, then real names before dotfiles, then alphabetical. Without
 * the dot rule a Next.js project opens on a screen of .editorconfig / .npmrc
 * before `src` is visible at all.
 */
const compare = (
  a: { name: string; isFolder: boolean },
  b: { name: string; isFolder: boolean },
) => {
  if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
  const aDot = a.name.startsWith('.');
  const bDot = b.name.startsWith('.');
  if (aDot !== bDot) return (aDot ? 1 : -1) as number;
  return a.name.localeCompare(b.name, undefined, { numeric: true });
};

@Controller('api')
export class FilesController {
  private readonly logger = new Logger('FilesController');

  constructor(
    @InjectRepository(Project)
    private readonly projects: Repository<Project>,
    private readonly workspaces: WorkspaceService,
  ) {}

  /**
   * What the agent changed, straight from git — every workspace starts as a
   * clone of the template, so `status --porcelain` is the honest diff. 204
   * when there is no git baseline; the client falls back to the full tree.
   */
  @Get('project/changes')
  @UseGuards(JWTAuthGuard)
  async changes(@Req() req: Request, @Query('path') projectId?: string) {
    if (!projectId) throw new BadRequestException('Missing path');
    await assertProjectAccess({
      projects: this.projects,
      req,
      projectPath: projectId,
      write: false,
    });

    const workspace = await this.workspaces.for(projectId);
    const changes = await workspace.changedFiles();
    return { changes };
  }

  /**
   * The points this project can be taken back to — one per agent turn, plus
   * the starter baseline. `versions: null` means the project has no git
   * history, which is what the client shows an empty state for.
   */
  @Get('project/versions')
  @UseGuards(JWTAuthGuard)
  async versions(@Req() req: Request, @Query('path') projectId?: string) {
    if (!projectId) throw new BadRequestException('Missing path');
    await assertProjectAccess({
      projects: this.projects,
      req,
      projectPath: projectId,
      write: false,
    });

    const workspace = await this.workspaces.for(projectId);
    return { versions: await workspace.versions() };
  }

  /**
   * Put the files back to a version. Write access: this rewrites the user's
   * project, so a read-only viewer of a public project must not reach it.
   */
  @Post('project/restore')
  @UseGuards(JWTAuthGuard)
  async restore(
    @Req() req: Request,
    @Body() body: { path?: string; versionId?: string },
  ) {
    const { path: projectId, versionId } = body ?? {};
    if (!projectId) throw new BadRequestException('Missing path');
    if (!versionId) throw new BadRequestException('Missing versionId');
    await assertProjectAccess({
      projects: this.projects,
      req,
      projectPath: projectId,
      write: true,
    });

    const workspace = await this.workspaces.for(projectId);
    await workspace.restore(versionId);
    return { changes: await workspace.changedFiles() };
  }

  /**
   * Restyle a page project: swap its token block for another system's.
   *
   * Snapshotted first, so the previous look is a version in the History panel
   * — the restyle is undoable by the machinery that already exists rather
   * than by a bespoke undo. Write access: this rewrites the user's page.
   */
  @Post('project/restyle')
  @UseGuards(JWTAuthGuard)
  async restyle(
    @Req() req: Request,
    @Body() body: { path?: string; style?: string },
  ) {
    const { path: projectId, style } = body ?? {};
    if (!projectId) throw new BadRequestException('Missing path');
    if (!style) throw new BadRequestException('Missing style');
    // An unknown id would otherwise silently restyle to the default, which
    // looks like the picker ignoring the click.
    if (!DESIGN_SYSTEMS.some((s) => s.id === style)) {
      throw new BadRequestException(`No such style: ${style}`);
    }
    await assertProjectAccess({
      projects: this.projects,
      req,
      projectPath: projectId,
      write: true,
    });

    const workspace = await this.workspaces.for(projectId);
    const html = await workspace.readFile('index.html');
    if (html === null) throw new NotFoundException('No index.html to restyle');

    const system = designSystem(style);
    const restyled = swapTokens(html, system.tokens);
    if (restyled === null) {
      return {
        applied: false,
        reason:
          'This page no longer keeps its colors in a :root block, so the style could not be swapped. Ask the agent to restyle it instead.',
      };
    }

    await workspace.snapshot(`Before restyle to ${system.name}`);
    await workspace.writeFile('index.html', restyled);
    return { applied: true, style: system.id, name: system.name };
  }

  @Get('project')
  @UseGuards(JWTAuthGuard)
  async tree(@Req() req: Request, @Query('path') projectId?: string) {
    if (!projectId) throw new BadRequestException('Missing path');
    await assertProjectAccess({
      projects: this.projects,
      req,
      projectPath: projectId,
      write: false,
    });

    const workspace = await this.workspaces.for(projectId);
    const paths = await workspace.listFiles();
    if (paths.length === 0) return { res: emptyTree() };

    // A segment is a folder when some path continues past it. Deriving that
    // from the path set is the only reliable signal — guessing from the name
    // made `.github` a file and `Dockerfile` a folder.
    const folders = new Set<string>();
    const childrenOf = new Map<string, Set<string>>();

    for (const p of paths) {
      const parts = p.split('/');
      for (let i = 0; i < parts.length; i++) {
        const parent = parts.slice(0, i).join('/');
        if (!childrenOf.has(parent)) childrenOf.set(parent, new Set());
        childrenOf.get(parent)!.add(parts[i]);
        if (i > 0) folders.add(parent);
      }
    }

    const items: Record<string, TreeItem> = {};
    const build = (parentPath: string): string[] =>
      [...(childrenOf.get(parentPath) ?? [])]
        .map((name) => {
          const p = parentPath ? `${parentPath}/${name}` : name;
          return { name, path: p, isFolder: folders.has(p) };
        })
        .sort(compare)
        .map(({ name, path: p, isFolder }) => {
          const index = `root/${p}`;
          items[index] = {
            index,
            data: name,
            isFolder,
            canMove: false,
            canRename: false,
            children: isFolder ? build(p) : [],
          };
          return index;
        });

    const children = build('');
    return {
      res: {
        root: {
          index: 'root',
          isFolder: true,
          canMove: false,
          canRename: false,
          children,
          data: 'Root',
        },
        ...items,
      },
    };
  }

  /**
   * Uploaded avatars and project covers. Stored next to the projects, so the
   * frontend's own copy of this route served nothing once the two were
   * deployed apart.
   */
  // `media/*` rather than a named wildcard: this is Nest 10 on Express 4,
  // where the `*path` form silently matches nothing.
  @Get('media/*')
  async media(@Req() req: Request, @Res() res: Response) {
    const rel = decodeURIComponent(req.path.replace(/^\/api\/media\//, ''));
    const base = getMediaDir();
    const full = path.resolve(base, rel);
    if (!full.startsWith(base + path.sep)) {
      throw new BadRequestException('Path escapes the media directory');
    }

    let file: Buffer;
    try {
      file = await fs.readFile(full);
    } catch {
      throw new NotFoundException(`No media at ${rel}`);
    }

    const type =
      {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.webp': 'image/webp',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
      }[path.extname(full).toLowerCase()] ?? 'application/octet-stream';

    res.setHeader('Content-Type', type);
    // Uploads are user-supplied bytes served from this origin. Without this a
    // browser may sniff past the declared type and run whatever is inside.
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(file);
  }

  @Get('file')
  @UseGuards(JWTAuthGuard)
  async read(@Req() req: Request, @Query('path') filePath?: string) {
    if (!filePath) throw new BadRequestException("Missing 'path'");
    await assertProjectAccess({
      projects: this.projects,
      req,
      projectPath: filePath,
      write: false,
    });

    const [projectPath, ...rest] = filePath.split('/');
    const workspace = await this.workspaces.for(projectPath);
    const content = await workspace.readFile(rest.join('/'));
    if (content == null) throw new NotFoundException(`Cannot read ${filePath}`);
    return { filePath, content };
  }

  @Post('file')
  @UseGuards(JWTAuthGuard)
  async write(
    @Req() req: Request,
    @Body() body: { filePath?: string; newContent?: string },
  ) {
    const { filePath, newContent } = body ?? {};
    // An empty string is a legitimate file body, so only absence is an error.
    if (!filePath || newContent == null) {
      throw new BadRequestException("Missing 'filePath' or 'newContent'");
    }
    await assertProjectAccess({
      projects: this.projects,
      req,
      projectPath: filePath,
      write: true,
    });

    const [projectPath, ...rest] = filePath.split('/');
    try {
      const workspace = await this.workspaces.for(projectPath);
      await workspace.writeFile(rest.join('/'), newContent);
    } catch (error) {
      this.logger.error(`Failed to write ${filePath}: ${error}`);
      throw new InternalServerErrorException('Failed to update file');
    }
    return { message: 'File updated successfully', filePath };
  }
}
