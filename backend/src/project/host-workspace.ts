import { promises as fs, createWriteStream, existsSync, mkdirSync } from 'node:fs';
import * as path from 'node:path';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import archiver from 'archiver';
import { getProjectsDir, getTempDir } from '../common/utils/common-path';
import type { LogLine, PreviewService } from './preview.service';
import { IGNORED_ENTRIES, ProjectWorkspace } from './workspace';

const IGNORED = new Set(IGNORED_ENTRIES);

/**
 * The project as a directory on the backend's own disk.
 *
 * This is the original behaviour, unchanged — it is fast, needs no account
 * anywhere, and is what makes a fresh clone work with nothing configured. It
 * offers no isolation: the agent runs bash with this process's privileges, so
 * it is only appropriate when every user is trusted.
 */
export class HostWorkspace implements ProjectWorkspace {
  constructor(
    private readonly projectPath: string,
    private readonly previews: PreviewService,
  ) {}

  private get root(): string {
    return path.join(getProjectsDir(), this.projectPath);
  }

  /**
   * Resolve a caller-supplied path inside the project.
   *
   * The argument arrives from the browser, so anything that climbs out of the
   * project is refused rather than trusted.
   */
  private resolve(relativePath: string): string {
    const full = path.resolve(this.root, relativePath);
    if (full !== this.root && !full.startsWith(this.root + path.sep)) {
      throw new BadRequestException('Path escapes the project');
    }
    return full;
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

  async listFiles(): Promise<string[]> {
    // A project whose directory is gone must error, not answer "no files" —
    // an empty 200 here is indistinguishable from a real empty project, and
    // the UI replaces a perfectly good tree with nothing.
    if (!existsSync(this.root)) {
      throw new NotFoundException('Project directory does not exist');
    }
    return this.walk(this.root);
  }

  async readFile(relativePath: string): Promise<string | null> {
    // Resolved outside the catch on purpose: a path that escapes the project
    // must surface as a refusal, not be flattened into "no such file" by the
    // same handler that covers a genuine miss.
    const full = this.resolve(relativePath);
    try {
      return await fs.readFile(full, 'utf-8');
    } catch {
      return null;
    }
  }

  async writeFile(relativePath: string, content: string): Promise<void> {
    const full = this.resolve(relativePath);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, content, 'utf-8');
  }

  async startPreview(): Promise<{ url: string }> {
    const { port } = await this.previews.start(this.projectPath);

    // Not the dev server's own address: it binds to loopback, which is this
    // machine and not the visitor's. The browser is sent back to this origin
    // and the preview proxy forwards it, keyed by a cookie the controller sets.
    //
    // Falling back to loopback matters for local development, where browser
    // and server really are the same machine and PUBLIC_ORIGIN is unset.
    const origin = process.env.PUBLIC_ORIGIN;
    return { url: origin ?? `http://127.0.0.1:${port}` };
  }

  async previewLogs(): Promise<LogLine[]> {
    return this.previews.logs(this.projectPath);
  }

  async stopPreview(): Promise<void> {
    await this.previews.stop(this.projectPath);
  }

  async internalPreviewUrl(): Promise<string | null> {
    const port = this.previews.portFor(this.projectPath);
    return port ? `http://127.0.0.1:${port}` : null;
  }

  async archive(
    projectName: string,
  ): Promise<{ zipPath: string; fileName: string }> {
    if (!existsSync(this.root)) {
      throw new Error(`Project directory not found at ${this.root}`);
    }

    const tempDir = getTempDir();
    if (!existsSync(tempDir)) mkdirSync(tempDir, { recursive: true });

    const fileName = `${projectName.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.zip`;
    const zipPath = path.join(tempDir, fileName);

    const output = createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(output);

    // `.next` matters here: the dev server builds into the project directory,
    // so without it every download carries hundreds of megabytes of output.
    archive.glob(
      '**/*',
      {
        cwd: this.root,
        ignore: IGNORED_ENTRIES.map((p) => `**/${p}/**`).concat(IGNORED_ENTRIES),
        dot: true,
      },
      {},
    );
    await archive.finalize();

    await new Promise<void>((resolve, reject) => {
      output.on('close', () => resolve());
      output.on('error', reject);
    });

    return { zipPath, fileName };
  }

  async remove(): Promise<void> {
    // The dev server holds the directory open and keeps writing to it, so
    // removing files under a running preview freed nothing.
    await this.stopPreview();
    await fs.rm(this.root, { recursive: true, force: true }).catch(() => {
      // The row is already gone; a stuck directory must not fail the delete.
    });
  }
}
