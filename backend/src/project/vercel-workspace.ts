import { existsSync, mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { BadRequestException, Logger } from '@nestjs/common';
import type { Sandbox } from '@vercel/sandbox';
import { SANDBOX_ROOT as ROOT } from '../chat/sandbox-provider';
import { getTempDir } from '../common/utils/common-path';
import type { LogLine } from './preview.service';
import {
  ChangedFile,
  IGNORED_ENTRIES,
  mergeChanges,
  parseNameStatus,
  parsePorcelain,
  parseVersionLog,
  ProjectWorkspace,
  Version,
  VERSION_LOG_FORMAT,
} from './workspace';

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

  async changedFiles(): Promise<ChangedFile[] | null> {
    // Against the starter, not against HEAD: turns commit, so HEAD moves with
    // the agent and "what changed" would empty itself after the very turn
    // that filled it. Uncommitted work is added on top. One round trip; the
    // two views are separated by a marker line.
    const result = await this.sandbox.runCommand({
      cmd: 'sh',
      args: [
        '-lc',
        `git rev-parse --git-dir >/dev/null 2>&1 || { echo __NO_GIT__; exit 0; }
         root=$(git rev-list --max-parents=0 HEAD | head -1)
         [ -n "$root" ] && git diff --name-status "$root" HEAD
         echo __WORKING__
         git status --porcelain`,
      ],
      cwd: ROOT,
    });
    const out = await result.stdout();
    if (out.includes('__NO_GIT__')) return null;
    const [committed, working] = out.split('__WORKING__');
    return mergeChanges(
      parseNameStatus(committed ?? ''),
      parsePorcelain(working ?? ''),
    );
  }

  /** One shell round trip in the project root. */
  private async sh(script: string): Promise<{ out: string; code: number }> {
    const result = await this.sandbox.runCommand({
      cmd: 'sh',
      args: ['-lc', script],
      cwd: ROOT,
    });
    return { out: await result.stdout(), code: result.exitCode ?? 0 };
  }

  async pendingEdits(): Promise<ChangedFile[]> {
    const { out, code } = await this.sh(
      `git rev-parse --git-dir >/dev/null 2>&1 || exit 3
       git status --porcelain`,
    );
    if (code !== 0) return [];
    return parsePorcelain(out);
  }

  /**
   * The sandbox has no committer identity configured, so every commit would
   * fail with "Please tell me who you are". Passed per command rather than
   * written into the clone's config, which the user's own git would inherit.
   */
  private static readonly AS_BOT =
    'git -c user.name=CodeFox -c user.email=bot@codefox.local';

  async snapshot(label: string): Promise<string | null> {
    // Single quotes around the label: it is the user's prompt, and it reaches
    // a shell. Any quote inside is escaped the POSIX way.
    const quoted = `'${label.replace(/'/g, `'\\''`)}'`;
    const { out, code } = await this.sh(
      `git rev-parse --git-dir >/dev/null 2>&1 || exit 3
       git status --porcelain | grep -q . || exit 4
       ${VercelWorkspace.AS_BOT} add -A &&
       ${VercelWorkspace.AS_BOT} commit -m ${quoted} --no-gpg-sign >/dev/null &&
       git rev-parse HEAD`,
    );
    // 3 = no git, 4 = nothing changed. Neither is a failure worth surfacing;
    // anything else is, but a snapshot must not be what fails a turn.
    if (code === 3 || code === 4) return null;
    if (code !== 0) {
      this.logger.warn(`Snapshot in ${this.sandbox.name} failed: exit ${code}`);
      return null;
    }
    return out.trim() || null;
  }

  async versions(): Promise<Version[] | null> {
    const { out, code } = await this.sh(
      `git rev-parse --git-dir >/dev/null 2>&1 || exit 3
       git rev-parse HEAD
       git log --format=${VERSION_LOG_FORMAT} --max-count=50`,
    );
    if (code !== 0) return null;
    const [head, ...log] = out.split('\n');
    return parseVersionLog(log.join('\n'), head ?? '');
  }

  async restore(versionId: string): Promise<void> {
    if (!/^[0-9a-f]{7,40}$/i.test(versionId)) {
      throw new BadRequestException('Not a version id');
    }
    await this.snapshot('Before restore');
    // `read-tree -u --reset`, not `checkout <sha> -- .`: the latter only
    // overwrites paths the old version contains, so a file the agent added
    // afterwards survived a restore that was supposed to predate it. Same
    // reasoning as HostWorkspace.restore().
    const { code } = await this.sh(
      `git cat-file -e ${versionId}^{commit} 2>/dev/null || exit 5
       git read-tree -u --reset ${versionId}`,
    );
    if (code === 5) {
      throw new BadRequestException('No such version in this project');
    }
    if (code !== 0) {
      throw new Error(`Restore failed in ${this.sandbox.name}: exit ${code}`);
    }
    await this.snapshot(`Restored to ${versionId.slice(0, 7)}`);
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
      // Failing to list is not the same as an empty project — returning []
      // here made the UI replace a real tree with nothing and read as the
      // project having wiped itself.
      throw new Error(
        `Listing ${this.sandbox.name} failed: exit ${result.exitCode}`,
      );
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
   *
   * The check is for Next, not for any listener: a fresh sandbox answers
   * every port with a placeholder "hello world" stub until the real server
   * binds, and any-200-called-ready handed visitors that stub. A Next page
   * always references /_next/ assets; the stub never does.
   */
  private async isPreviewRunning(): Promise<boolean> {
    const check = await this.sandbox.runCommand('sh', [
      '-lc',
      `curl -s --max-time 5 http://127.0.0.1:${this.previewPort} ` +
        `| grep -q '/_next/' && echo up || echo down`,
    ]);
    return (await check.stdout()).trim().endsWith('up');
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
        this.logger.warn(
          `Could not stop ${this.sandbox.name}: ${String(error)}`,
        ),
      );
  }
}
