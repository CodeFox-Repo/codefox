import * as path from 'node:path';
import { Logger } from '@nestjs/common';
import { createVercelSandbox } from '@ai-sdk/sandbox-vercel';
import { getProjectsDir } from '../common/utils/common-path';
import { createLocalSandbox } from './local-sandbox';

const logger = new Logger('SandboxProvider');

/** Port the preview dev server listens on inside a remote sandbox. */
export const REMOTE_PREVIEW_PORT = 3000;

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

export const sandboxFor = ({ projectPath, harnessId }: SandboxFor) => {
  if (sandboxMode() === 'host') {
    return createLocalSandbox({
      workingDirectory: path.join(getProjectsDir(), projectPath),
      harnessId,
    });
  }

  if (!vercelConfigured()) {
    throw new Error(
      'SANDBOX_PROVIDER=vercel needs VERCEL_PROJECT_ID (and VERCEL_TEAM_ID ' +
        'for a team account). Credentials come from VERCEL_TOKEN, an OIDC ' +
        'token, or a logged-in Vercel CLI.',
    );
  }

  logger.debug(`Creating Vercel sandbox for ${projectPath}`);

  // A sandbox auto-terminates at `timeout`; the harness extends it while a
  // turn is in flight. Ports must be declared here — a sandbox can expose at
  // most four, and the harness leases one for its own bridge.
  return createVercelSandbox({
    runtime: 'node24',
    ports: [REMOTE_PREVIEW_PORT],
    timeout: Number(process.env.SANDBOX_TIMEOUT_MS ?? 30 * 60 * 1000),
    resources: { vcpus: Number(process.env.SANDBOX_VCPUS ?? 2) },
    source: { type: 'git', url: TEMPLATE_REPO, depth: 1 },
  });
};
