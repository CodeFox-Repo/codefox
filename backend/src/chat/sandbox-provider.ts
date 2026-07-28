import * as path from 'node:path';
import { Logger } from '@nestjs/common';
import { createVercelSandbox } from '@ai-sdk/sandbox-vercel';
import { Sandbox } from '@vercel/sandbox';
import { getProjectsDir } from '../common/utils/common-path';
import { createLocalSandbox } from './local-sandbox';

const logger = new Logger('SandboxProvider');

/** Where a sandbox checks the project out. Fixed by the platform. */
export const SANDBOX_ROOT = '/vercel/sandbox';

/** Port the preview dev server listens on inside a remote sandbox. */
export const REMOTE_PREVIEW_PORT = 3000;

/**
 * Ports the harness may lease for its bridge. A sandbox exposes at most four
 * and the preview owns one, so three are left — which also caps how many agent
 * sessions can share one project's sandbox at a time.
 */
const BRIDGE_PORTS = [3001, 3002, 3003];

/**
 * How long a sandbox may sit before Vercel stops it. This is a wall-clock
 * deadline, not an idle timer — Vercel has no idle setting — so every turn
 * pushes it out again, which makes it behave as one.
 */
const IDLE_MS = Number(process.env.SANDBOX_IDLE_MS ?? 10 * 60 * 1000);

/**
 * Where a project's files live while the agent works on them.
 *
 * `host` — the backend's own disk, under `.codefox/projects`. Zero setup and
 * the preview is a local dev server, which is what makes `pnpm dev` work with
 * nothing installed. It is *not* isolation: the agent runs bash with the
 * backend process's privileges, so it is only safe when every user is trusted.
 *
 * `vercel` — a real remote microVM per session. Required for anything
 * multi-tenant, because there a prompt is untrusted input and `host` would
 * hand it the server.
 */
export type SandboxMode = 'host' | 'vercel';

export const sandboxMode = (): SandboxMode =>
  process.env.SANDBOX_PROVIDER === 'vercel' ? 'vercel' : 'host';

/**
 * Only checks what is ours to demand. Credentials themselves resolve inside
 * `@vercel/sandbox` from OIDC, the environment, *or* a logged-in Vercel CLI's
 * auth.json — an earlier version of this guard looked for VERCEL_TOKEN only
 * and rejected a perfectly good CLI login.
 */
export const vercelConfigured = (): boolean =>
  Boolean(process.env.VERCEL_PROJECT_ID);

export interface SandboxFor {
  /** Project directory name under `.codefox/projects` (host mode). */
  projectPath: string;
  harnessId: string;
}

/**
 * The template every new project starts from. In host mode it is cloned once
 * and copied per project; in vercel mode the sandbox clones it directly, which
 * is why no files are uploaded on the way in.
 */
const TEMPLATE_REPO =
  process.env.TEMPLATE_REPO ??
  'https://github.com/Sma1lboy/nextjs-shadcn-template.git';

/**
 * The one microVM that belongs to a project.
 *
 * Named per project rather than per session so a turn resumes the previous
 * turn's work instead of a fresh clone of the template. `persistent` makes
 * Vercel snapshot the filesystem on stop and restore it on the next resume,
 * so nothing here serialises state by hand.
 *
 * Shared deliberately: the agent, the file tree, the editor, the preview and
 * the download all have to be looking at the same machine.
 */
export const sandboxHandle = async (projectPath: string): Promise<Sandbox> => {
  if (!vercelConfigured()) {
    throw new Error(
      'SANDBOX_PROVIDER=vercel needs VERCEL_PROJECT_ID (and VERCEL_TEAM_ID ' +
        'for a team account). Credentials come from VERCEL_TOKEN, an OIDC ' +
        'token, or a logged-in Vercel CLI.',
    );
  }

  const sandbox = await Sandbox.getOrCreate({
    name: `codefox-${projectPath}`,
    persistent: true,
    runtime: 'node24',
    ports: [REMOTE_PREVIEW_PORT, ...BRIDGE_PORTS],
    timeout: IDLE_MS,
    resources: { vcpus: Number(process.env.SANDBOX_VCPUS ?? 2) },
    // Only applied when the sandbox is created; a resume keeps its own files.
    source: { type: 'git', url: TEMPLATE_REPO, depth: 1 },
  });

  // Activity is the only thing that keeps a sandbox alive. Extending on every
  // use is what turns Vercel's wall-clock deadline into an idle timeout.
  await sandbox
    .extendTimeout(IDLE_MS)
    .catch((error: unknown) =>
      logger.warn(`Could not extend sandbox lifetime: ${String(error)}`),
    );

  return sandbox;
};

export const sandboxFor = async ({ projectPath, harnessId }: SandboxFor) => {
  if (sandboxMode() === 'host') {
    return createLocalSandbox({
      workingDirectory: path.join(getProjectsDir(), projectPath),
      harnessId,
    });
  }

  const sandbox = await sandboxHandle(projectPath);
  logger.debug(`Sandbox ${sandbox.name} ready for ${projectPath}`);

  // The provider treats a supplied sandbox as caller-owned, so its stop() and
  // destroy() are no-ops — the sandbox outlives the agent session and is
  // reclaimed by the timeout above.
  return createVercelSandbox({ sandbox, bridgePorts: BRIDGE_PORTS });
};
