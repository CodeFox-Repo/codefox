import { spawn as nodeSpawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import { createServer, AddressInfo } from 'node:net';
import * as path from 'node:path';
import { Readable } from 'node:stream';

/**
 * A `HarnessV1SandboxProvider` backed by the host itself: a real directory,
 * real child processes, real localhost ports.
 *
 * Bridge-backed harnesses (Claude Code, Codex) need three things from a
 * sandbox — a writable working directory, the ability to install and run node
 * processes, and a reachable port for the bridge WebSocket. On a developer
 * machine all three are native, so no container or cloud sandbox is required.
 *
 * "Sandbox" here therefore means *scoped working directory*, not isolation.
 * The agent runs with the privileges of the backend process. Do not point this
 * at untrusted input on a shared host — use a real network sandbox
 * (`@ai-sdk/sandbox-vercel`) for that.
 */

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

const toWebStream = (stream: NodeJS.ReadableStream) =>
  Readable.toWeb(stream as Readable) as ReadableStream<Uint8Array>;

const collect = async (stream: NodeJS.ReadableStream): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
};

interface ProcessOptions {
  command: string;
  workingDirectory?: string;
  env?: Record<string, string>;
  abortSignal?: AbortSignal;
}

/**
 * `root` exists only so the framework's composed session path
 * (`<root>/<harnessId>-<sessionId>`) can be a symlink into the project. Every
 * *other* path — relative reads, a shell command's default cwd — must resolve
 * against `base`, the project itself. Resolving those against `root` put the
 * agent's shell in `.codefox/projects`, where every other user's project is a
 * sibling directory away.
 */
const createSession = async (root: string, base: string, ports: number[]) => {
  await mkdir(root, { recursive: true });

  const resolvePath = (p: string) =>
    path.isAbsolute(p) ? p : path.join(base, p);

  const start = ({
    command,
    workingDirectory,
    env,
    abortSignal,
  }: ProcessOptions) => {
    // Our own loader flags have no business reaching an unrelated CLI. The
    // harness bootstraps its runtime with corepack's pnpm shim, which dies on
    // ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING when it inherits them.
    const { NODE_OPTIONS: _drop, ...inherited } = process.env;
    return nodeSpawn('bash', ['-lc', command], {
      cwd: workingDirectory ? resolvePath(workingDirectory) : base,
      env: { ...inherited, ...env },
      signal: abortSignal,
    });
  };

  const session: any = {
    id: `local-${path.basename(root)}`,
    defaultWorkingDirectory: root,
    ports,

    description:
      `Local sandbox. Working directory: ${base}. ` +
      `Exposed ports: ${ports.join(', ') || 'none'} on 127.0.0.1.`,

    readFile: async ({ path: p }: { path: string }) => {
      try {
        return toWebStream(createReadStream(resolvePath(p)));
      } catch {
        return null;
      }
    },
    readBinaryFile: async ({ path: p }: { path: string }) => {
      try {
        return new Uint8Array(await readFile(resolvePath(p)));
      } catch {
        return null;
      }
    },
    readTextFile: async ({
      path: p,
      encoding = 'utf-8',
      startLine,
      endLine,
    }: {
      path: string;
      encoding?: BufferEncoding;
      startLine?: number;
      endLine?: number;
    }) => {
      let text: string;
      try {
        text = await readFile(resolvePath(p), encoding);
      } catch {
        return null;
      }
      if (startLine == null && endLine == null) return text;
      const lines = text.split('\n');
      return lines
        .slice((startLine ?? 1) - 1, endLine ?? lines.length)
        .join('\n');
    },

    writeFile: async ({ path: p, content }: { path: string; content: any }) => {
      const absolute = resolvePath(p);
      await mkdir(path.dirname(absolute), { recursive: true });
      const bytes = Buffer.from(await new Response(content).arrayBuffer());
      await writeFile(absolute, bytes);
    },
    writeBinaryFile: async ({
      path: p,
      content,
    }: {
      path: string;
      content: Uint8Array;
    }) => {
      const absolute = resolvePath(p);
      await mkdir(path.dirname(absolute), { recursive: true });
      await writeFile(absolute, Buffer.from(content));
    },
    writeTextFile: async ({
      path: p,
      content,
      encoding = 'utf-8',
    }: {
      path: string;
      content: string;
      encoding?: BufferEncoding;
    }) => {
      const absolute = resolvePath(p);
      await mkdir(path.dirname(absolute), { recursive: true });
      await writeFile(absolute, content, encoding);
    },

    spawn: async (options: ProcessOptions) => {
      const child = start(options);
      return {
        pid: child.pid,
        stdout: toWebStream(child.stdout),
        stderr: toWebStream(child.stderr),
        wait: () =>
          new Promise<{ exitCode: number }>((resolve, reject) => {
            child.on('error', reject);
            child.on('close', (code) => resolve({ exitCode: code ?? 0 }));
          }),
        kill: async () => {
          child.kill('SIGTERM');
        },
      };
    },

    run: async (options: ProcessOptions) => {
      const child = start(options);
      const [stdout, stderr, { exitCode }] = await Promise.all([
        collect(child.stdout),
        collect(child.stderr),
        new Promise<{ exitCode: number }>((resolve, reject) => {
          child.on('error', reject);
          child.on('close', (code) => resolve({ exitCode: code ?? 0 }));
        }),
      ]);
      return { exitCode, stdout, stderr };
    },

    // The bridge runs on this host, so a "public" port URL is just localhost.
    getPortUrl: async ({
      port,
      protocol = 'http',
    }: {
      port: number;
      protocol?: 'http' | 'https' | 'ws';
    }) => `${protocol}://127.0.0.1:${port}`,

    stop: async () => {},

    // Deliberately not implemented: the working directory is the user's
    // project, and destroy() would delete it.
    restricted: () => {
      const {
        id,
        defaultWorkingDirectory,
        ports,
        getPortUrl,
        stop,
        restricted,
        ...bare
      } = session;
      return bare;
    },
  };

  return session;
};

export interface LocalSandboxOptions {
  /** Directory the agent should work in — normally the project directory. */
  workingDirectory: string;
  /** Harness id, used to predict the session directory the framework composes. */
  harnessId: string;
}

/**
 * The framework runs each session in `<defaultWorkingDirectory>/<harnessId>-<sessionId>`
 * rather than in `defaultWorkingDirectory` itself. To make the agent operate on
 * the project directory directly, that composed path is pre-created as a
 * symlink pointing at it.
 */
export const createLocalSandbox = ({
  workingDirectory,
  harnessId,
}: LocalSandboxOptions) => ({
  specificationVersion: 'harness-sandbox-v1' as const,
  providerId: 'codefox-local',

  createSession: async (options: { sessionId?: string } = {}) => {
    const root = path.dirname(workingDirectory);
    const session = await createSession(root, workingDirectory, [
      await freePort(),
    ]);

    if (options.sessionId) {
      const composed = path.join(root, `${harnessId}-${options.sessionId}`);
      await symlink(workingDirectory, composed, 'dir').catch(() => {
        // Already present (resumed session) — nothing to do.
      });
    }

    return session;
  },
});
