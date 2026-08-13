import { Field, ObjectType } from '@nestjs/graphql';
import type { ProjectWorkspace } from './workspace';

/**
 * Put a page project on the user's own Vercel account.
 *
 * The whole deploy is one POST: Vercel's /v13/deployments takes the files
 * inline as base64, so there is no bundle, no upload session, no CLI.
 *
 * ponytail: Vercel only. Cloudflare Pages is ~6 calls (project ensure, upload
 * token, missing-hash check, batched asset upload, upsert, deploy) plus an
 * account id the user has to go find — for the same outcome. Add it when
 * someone actually asks; `provider` is already on the wire.
 */
@ObjectType()
export class DeployResult {
  @Field() ok: boolean;
  /** Where it went live. Empty on failure. */
  @Field() url: string;
  /** The provider's own words when it refused. */
  @Field() message: string;
}

/** Never shipped: agent scratch, vcs data, the user's own uploads. */
const SKIP = /^(\.git|node_modules|\.agent-runs|\.codefox-uploads|\.next|dist|build)\//;

/**
 * ponytail: skipped, not deployed. The workspace reads text — a PNG through
 * a utf8 round-trip arrives corrupt, and a broken image is worse than a
 * missing one because it looks deployed. Upgrade path: a bytes-capable
 * readFile on ProjectWorkspace, then base64 these directly.
 */
const BINARY =
  /\.(png|jpe?g|gif|webp|avif|ico|bmp|woff2?|ttf|otf|eot|mp[34]|webm|mov|pdf|zip|wasm)$/i;

/**
 * The files a static host should serve, and the binary ones it cannot yet.
 * Read through the workspace so this works the same on a host disk and in a
 * sandbox.
 */
export async function collectFiles(workspace: ProjectWorkspace): Promise<{
  files: { file: string; data: string }[];
  skipped: string[];
}> {
  const paths = (await workspace.listFiles()).filter((p) => !SKIP.test(p));
  const files: { file: string; data: string }[] = [];
  const skipped: string[] = [];
  for (const file of paths) {
    if (BINARY.test(file)) {
      skipped.push(file);
      continue;
    }
    const data = await workspace.readFile(file);
    if (data !== null) files.push({ file, data });
  }
  return { files, skipped };
}

/**
 * A Vercel project name: lowercase, alphanumeric and dashes, ≤100.
 *
 * Stripping non-ASCII leaves "我的网站" as nothing at all, so every
 * Chinese-named project deployed to the SAME slug — and target:'production'
 * means each one silently replaced the last. When nothing survives the
 * strip, the project id is the name.
 */
export function slugFor(name: string, projectId = ''): string {
  const stem = name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const id = projectId.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
  return `codefox-${stem || id || 'page'}`.slice(0, 100).replace(/-$/, '');
}

/** The exact body Vercel expects. Split out so it can be tested without a token. */
export function vercelPayload(
  name: string,
  files: { file: string; data: string }[],
  /** Disambiguates a name with no ASCII left — see slugFor. */
  projectId = '',
) {
  return {
    name: slugFor(name, projectId),
    files: files.map((f) => ({
      file: f.file,
      data: Buffer.from(f.data, 'utf8').toString('base64'),
      encoding: 'base64' as const,
    })),
    // No framework: these are static pages, and letting Vercel guess makes it
    // look for a build step that does not exist.
    projectSettings: { framework: null },
    target: 'production' as const,
  };
}

/**
 * POST the deployment. The only function here that touches the network, so a
 * test can hand in its own `post`.
 */
export async function deployToVercel(
  token: string,
  name: string,
  files: { file: string; data: string }[],
  post = fetch,
  projectId = '',
): Promise<DeployResult> {
  if (!files.length) {
    return { ok: false, url: '', message: 'This project has no files to deploy.' };
  }
  let res: Response;
  try {
    res = await post('https://api.vercel.com/v13/deployments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(vercelPayload(name, files, projectId)),
      // This runs inside the project's write queue, so a hung upload blocks
      // the user's next chat turn behind it. 60s is well past a page.
      signal: AbortSignal.timeout(60_000),
    });
  } catch (error) {
    return {
      ok: false,
      url: '',
      message:
        (error as Error)?.name === 'TimeoutError'
          ? 'Vercel did not respond within 60s. Nothing was deployed.'
          : `Could not reach Vercel: ${(error as Error)?.message ?? error}`,
    };
  }

  const body = await res.text();
  const json = (() => {
    try {
      return JSON.parse(body);
    } catch {
      return null;
    }
  })();

  if (!res.ok) {
    // Verbatim, like the preview diagnostics: "the token is missing scope" and
    // "the name is taken" are both 403 and only the body says which.
    return {
      ok: false,
      url: '',
      message:
        json?.error?.message ??
        body.slice(0, 300) ??
        `Vercel refused the deploy (${res.status}).`,
    };
  }

  const url = json?.url ?? json?.alias?.[0] ?? '';
  return url
    ? { ok: true, url: `https://${String(url).replace(/^https?:\/\//, '')}`, message: '' }
    : { ok: false, url: '', message: 'Vercel accepted the deploy but returned no URL.' };
}
