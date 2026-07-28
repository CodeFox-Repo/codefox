import { existsSync, mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { BadRequestException, Logger } from '@nestjs/common';
import type { Sandbox } from '@vercel/sandbox';
import { SANDBOX_ROOT as ROOT } from '../chat/sandbox-provider';
import { getTempDir } from '../common/utils/common-path';
import type { LogLine } from './preview.service';
import { IGNORED_ENTRIES, ProjectWorkspace } from './workspace';

/** Bounded so one enormous project cannot exhaust the backend's memory. */
const MAX_FILES = 5000;

/**
 * The project as a Vercel microVM.
 *
 * Real isolation: the agent's shell runs in a machine of its own, so a prompt
 * — which is untrusted input — can no longer reach this server's disk, its
 * environment, or anyone else's project. That is the whole reason for this
 * class; everything below is the same set of operations the host does, done
 * over the sandbox API instead of `node:fs`.
 */
export class VercelWorkspace implements ProjectWorkspace {
  private readonly logger = new Logger('VercelWorkspace');

  constructor(
    private readonly sandbox: Sandbox,
    private readonly previewPort: number,
  ) {}

  /** Refuse a path that climbs out of the project, same as on the host. */
  private resolve(relativePath: string): string {
    const full = path.posix.resolve(ROOT, relativePath);
    if (full !== ROOT && !full.startsWith(`${ROOT}/`)) {
      throw new BadRequestException('Path escapes the project');
    }
    return full;
  }

  async listFiles(): Promise<string[]> {
    // `find` rather than a recursive walk over the API: one round trip instead
    // of one per directory, which over a network is the difference between a
    // file tree that opens and one that visibly crawls.
    const prune = IGNORED_ENTRIES.map((name) => `-name '${name}'`).join(' -o ');
    const command = `find . \\( ${prune} \\) -prune -o -type f -print`;

    const result = await this.sandbox.runCommand({
      cmd: 'sh',
      args: ['-lc', command],
      cwd: ROOT,
    });
    if (result.exitCode !== 0) {
      this.logger.warn(`Listing ${this.sandbox.name} failed: ${result.exitCode}`);
      return [];
    }

    return (await result.stdout())
      .split('\n')
      .map((line) => line.trim().replace(/^\.\//, ''))
      .filter(Boolean)
      .slice(0, MAX_FILES);
  }

  async readFile(relativePath: string): Promise<string | null> {
    // Same as the host: the path check throws, only the read is forgiving.
    const full = this.resolve(relativePath);
    const buffer = await this.sandbox
      .readFileToBuffer({ path: full })
      .catch(() => null);
    return buffer ? buffer.toString('utf-8') : null;
  }

  async writeFile(relativePath: string, content: string): Promise<void> {
    const full = this.resolve(relativePath);
    // No `recursive` option on the API; `mkdir -p` is the equivalent and also
    // succeeds when the directory is already there.
    await this.sandbox.runCommand({
      cmd: 'mkdir',
      args: ['-p', path.posix.dirname(full)],
    });
    await this.sandbox.writeFiles([{ path: full, content }]);
  }

  /**
   * Make sure the project's dependencies exist.
   *
   * A sandbox starts from a git clone, which carries no `node_modules` — so
   * `next dev` had nothing to run. The install is slow once and free after
   * that: a persistent sandbox is snapshotted when it stops, so the installed
   * tree comes back with it on the next resume.
   */
  private async ensureDependencies(): Promise<void> {
    const present = await this.sandbox.runCommand({
      cmd: 'sh',
      args: ['-lc', 'test -d node_modules && echo yes'],
      cwd: ROOT,
    });
    if ((await present.stdout()).includes('yes')) return;

    this.logger.log(`Installing dependencies in ${this.sandbox.name}`);
    const install = await this.sandbox.runCommand({
      cmd: 'sh',
      args: ['-lc', 'npm install --no-audit --no-fund'],
      cwd: ROOT,
      timeoutMs: 10 * 60 * 1000,
    });
    if (install.exitCode !== 0) {
      throw new Error(
        `Dependency install failed: ${(await install.stderr()).slice(-500)}`,
      );
    }
  }

  async startPreview(): Promise<{ url: string }> {
    if (!(await this.isPreviewRunning())) {
      await this.ensureDependencies();
      // Detached: `runCommand` waits for the process to finish, and a dev
      // server never does. The log goes to a file so the Console tab has
      // something to read afterwards.
      await this.sandbox.runCommand('sh', [
        '-lc',
        `cd ${ROOT} && (nohup npx next dev -H 0.0.0.0 -p ${this.previewPort} ` +
          `> /tmp/preview.log 2>&1 &) && sleep 1`,
      ]);
      await this.waitForPreview();
    }

    // A sandbox publishes its own address, so unlike the host there is nothing
    // to proxy — the browser talks to the microVM directly.
    return { url: this.sandbox.domain(this.previewPort) };
  }

  /**
   * Whether the dev server is answering — not whether the app is healthy.
   *
   * These are different questions and conflating them cost two minutes per
   * request: a project whose own code throws answers 500, `curl -f` called
   * that a failure, and the caller waited out the whole startup timeout before
   * reporting that the preview had not started. A 500 from the user's app is
   * something they should see in the preview, not something to hide behind a
   * timeout.
   */
  private async isPreviewRunning(): Promise<boolean> {
    const check = await this.sandbox.runCommand('sh', [
      '-lc',
      `curl -s -o /dev/null -w '%{http_code}' --max-time 5 ` +
        `http://127.0.0.1:${this.previewPort} || echo 000`,
    ]);
    const code = (await check.stdout()).trim().slice(-3);
    return /^[1-5]\d\d$/.test(code);
  }

  private async waitForPreview(): Promise<void> {
    // Long enough for a cold `next dev` on a small microVM; a caller that gets
    // here early would hand the browser a URL that answers nothing.
    const attempts = 45;
    for (let i = 0; i < attempts; i++) {
      if (await this.isPreviewRunning()) return;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    throw new Error('Preview did not start in time');
  }

  async previewLogs(): Promise<LogLine[]> {
    const result = await this.sandbox.runCommand('sh', [
      '-lc',
      'tail -n 500 /tmp/preview.log 2>/dev/null || true',
    ]);
    const at = Date.now();
    return (await result.stdout())
      .split('\n')
      .filter(Boolean)
      .map((text) => ({ at, stream: 'out' as const, text }));
  }

  async stopPreview(): Promise<void> {
    await this.sandbox
      .runCommand('sh', ['-lc', `pkill -f "next dev" || true`])
      .catch(() => undefined);
  }

  async internalPreviewUrl(): Promise<string | null> {
    // The published address, not loopback: the screenshot browser runs on the
    // backend, which has no route into the sandbox's private network.
    return (await this.isPreviewRunning())
      ? this.sandbox.domain(this.previewPort)
      : null;
  }

  async archive(
    projectName: string,
  ): Promise<{ zipPath: string; fileName: string }> {
    const remote = '/tmp/project.zip';

    // Python rather than `zip`, which this image does not ship — an earlier
    // version exited 127 and the download button just failed. Written to a
    // file rather than passed as `-c` so the ignore list needs no shell
    // quoting, and it produces a real zip so the client contract is unchanged.
    await this.sandbox.writeFiles([
      {
        path: '/tmp/codefox-archive.py',
        content: [
          'import os, sys, zipfile',
          `IGNORED = set(${JSON.stringify(IGNORED_ENTRIES)})`,
          `root, out = ${JSON.stringify(ROOT)}, ${JSON.stringify(remote)}`,
          'with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:',
          '    for base, dirs, files in os.walk(root):',
          '        dirs[:] = [d for d in dirs if d not in IGNORED]',
          '        for name in files:',
          '            if name in IGNORED: continue',
          '            full = os.path.join(base, name)',
          '            z.write(full, os.path.relpath(full, root))',
        ].join('\n'),
      },
    ]);

    const zipped = await this.sandbox.runCommand({
      cmd: 'python3',
      args: ['/tmp/codefox-archive.py'],
      cwd: ROOT,
      timeoutMs: 5 * 60 * 1000,
    });
    if (zipped.exitCode !== 0) {
      throw new Error(
        `Could not archive the project: ${(await zipped.stderr()).slice(-300)}`,
      );
    }

    const buffer = await this.sandbox.readFileToBuffer({ path: remote });
    if (!buffer) throw new Error('Archive was not produced');

    const tempDir = getTempDir();
    if (!existsSync(tempDir)) mkdirSync(tempDir, { recursive: true });
    const fileName = `${projectName.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.zip`;
    const zipPath = path.join(tempDir, fileName);
    await writeFile(zipPath, buffer);

    return { zipPath, fileName };
  }

  async remove(): Promise<void> {
    // Stopping is what releases the microVM and its snapshot; the files go
    // with it, so there is nothing else to clean up.
    await this.sandbox
      .stop()
      .catch((error: unknown) =>
        this.logger.warn(`Could not stop ${this.sandbox.name}: ${String(error)}`),
      );
  }
}
