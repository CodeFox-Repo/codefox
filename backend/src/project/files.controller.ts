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
import { getMediaDir, getProjectsDir } from '../common/utils/common-path';
import { Project } from './project.model';

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

/** Never part of the user's project: shared deps, vcs data, build output. */
const IGNORED = new Set([
  'node_modules',
  '.codefox-uploads',
  '.git',
  '.next',
  '.turbo',
  '.vercel',
  '.cache',
  'dist',
  'build',
  'out',
  'coverage',
  '.DS_Store',
]);

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
  ) {}

  /**
   * Resolve a caller-supplied path under the projects directory.
   *
   * The argument arrives from the browser, so it is checked rather than
   * trusted: anything that escapes the projects directory is refused.
   */
  private resolve(relative: string): string {
    const base = getProjectsDir();
    const full = path.resolve(base, relative);
    if (full !== base && !full.startsWith(base + path.sep)) {
      throw new BadRequestException('Path escapes the projects directory');
    }
    return full;
  }

  /**
   * Refuse a path that does not belong to the caller.
   *
   * These routes had no authentication of any kind, so knowing a project's
   * directory name — the first segment of every path they take — was enough
   * to read anyone's source and to write files into their project. Traversal
   * was blocked, which only ever kept a caller inside the directory holding
   * every user's work.
   *
   * Reads are allowed on a public project so the gallery can show one without
   * forking it first; writes are for the owner alone.
   */
  private async authorize(
    req: Request,
    relative: string,
    write: boolean,
  ): Promise<void> {
    const userId = (req as any).user?.userId;
    if (!userId) throw new ForbiddenException('Not signed in');

    // Every path these routes accept starts with the project's directory.
    const projectPath = relative.split('/')[0];
    if (!projectPath) throw new BadRequestException('Missing project');

    const project = await this.projects.findOne({
      where: { projectPath, isDeleted: false },
    });
    if (!project) throw new NotFoundException('No such project');

    const owns = project.userId === userId;
    if (owns || (!write && project.isPublic)) return;
    throw new ForbiddenException('This project is not yours');
  }

  private async walk(dir: string, prefix = ''): Promise<string[]> {
    let entries: Awaited<ReturnType<typeof fs.readdir>>;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return [];
    }

    const out: string[] = [];
    for (const entry of entries) {
      if (IGNORED.has(entry.name)) continue;
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        out.push(...(await this.walk(path.join(dir, entry.name), rel)));
      } else {
        out.push(rel);
      }
    }
    return out;
  }

  @Get('project')
  @UseGuards(JWTAuthGuard)
  async tree(@Req() req: Request, @Query('path') projectId?: string) {
    if (!projectId) throw new BadRequestException('Missing path');
    await this.authorize(req, projectId, false);

    const paths = await this.walk(this.resolve(projectId));
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
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(file);
  }

  @Get('file')
  @UseGuards(JWTAuthGuard)
  async read(@Req() req: Request, @Query('path') filePath?: string) {
    if (!filePath) throw new BadRequestException("Missing 'path'");
    await this.authorize(req, filePath, false);
    try {
      const content = await fs.readFile(this.resolve(filePath), 'utf-8');
      return { filePath, content };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new NotFoundException(`Cannot read ${filePath}`);
    }
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
    await this.authorize(req, filePath, true);

    const full = this.resolve(filePath);
    try {
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, newContent, 'utf-8');
    } catch (error) {
      this.logger.error(`Failed to write ${filePath}: ${error}`);
      throw new InternalServerErrorException('Failed to update file');
    }
    return { message: 'File updated successfully', filePath };
  }
}
