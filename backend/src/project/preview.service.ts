import { ChildProcess, spawn } from 'node:child_process';
import { connect, createServer, AddressInfo } from 'node:net';
import * as path from 'node:path';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import fsExtra from 'fs-extra';
import { getProjectsDir } from '../common/utils/common-path';

const { existsSync } = fsExtra;

interface Preview {
  port: number;
  child: ChildProcess;
  ready: Promise<void>;
}

const READY_TIMEOUT_MS = 90_000;

const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      server.close(() => resolve(port));
    });
  });

const portAccepts = (port: number): Promise<boolean> =>
  new Promise((resolve) => {
    const socket = connect({ port, host: '127.0.0.1' });
    const done = (ok: boolean) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(1000);
    socket.on('connect', () => done(true));
    socket.on('timeout', () => done(false));
    socket.on('error', () => done(false));
  });

/**
 * Runs each generated project's dev server on the host and hands the UI a
 * localhost URL to iframe.
 *
 * One server per project, kept alive between requests — a Next dev server is
 * expensive to start and cheap to keep. Nothing here is isolated: the process
 * runs with the backend's privileges, same trade-off as the local sandbox the
 * agent uses.
 */
@Injectable()
export class PreviewService implements OnModuleDestroy {
  private readonly logger = new Logger(PreviewService.name);
  private readonly previews = new Map<string, Preview>();

  async start(projectPath: string): Promise<{ port: number }> {
    const existing = this.previews.get(projectPath);
    if (existing && !existing.child.killed) {
      await existing.ready;
      return { port: existing.port };
    }

    const cwd = path.join(getProjectsDir(), projectPath);
    if (!existsSync(path.join(cwd, 'package.json'))) {
      throw new Error(`No project at ${projectPath}`);
    }

    const port = await freePort();
    // No --turbopack: projects share one node_modules by symlink, and
    // Turbopack resolves through the link and then cannot find Next.
    const child = spawn(
      'npx',
      ['next', 'dev', '-H', '127.0.0.1', '-p', String(port)],
      { cwd, env: { ...process.env, NODE_ENV: 'development' } },
    );

    child.stdout?.on('data', (d) =>
      this.logger.debug(`[${projectPath}] ${String(d).trim()}`),
    );
    child.stderr?.on('data', (d) =>
      this.logger.debug(`[${projectPath}] ${String(d).trim()}`),
    );
    child.on('exit', (code) => {
      this.logger.log(`[${projectPath}] dev server exited (${code})`);
      this.previews.delete(projectPath);
    });

    // A dev server that dies during boot should surface now, not after the
    // full readiness timeout.
    let exited = false;
    child.once('exit', () => {
      exited = true;
    });

    const ready = this.waitForPort(port, projectPath, () => exited);
    this.previews.set(projectPath, { port, child, ready });

    await ready;
    return { port };
  }

  private async waitForPort(
    port: number,
    projectPath: string,
    hasExited: () => boolean,
  ): Promise<void> {
    const deadline = Date.now() + READY_TIMEOUT_MS;
    while (Date.now() < deadline) {
      if (await portAccepts(port)) {
        this.logger.log(`[${projectPath}] preview ready on ${port}`);
        return;
      }
      if (hasExited()) {
        throw new Error(`Preview for ${projectPath} exited during startup`);
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error(`Preview for ${projectPath} did not start in time`);
  }

  stop(projectPath: string): void {
    const preview = this.previews.get(projectPath);
    if (!preview) return;
    preview.child.kill('SIGTERM');
    this.previews.delete(projectPath);
  }

  onModuleDestroy() {
    for (const [, preview] of this.previews) preview.child.kill('SIGTERM');
    this.previews.clear();
  }
}
