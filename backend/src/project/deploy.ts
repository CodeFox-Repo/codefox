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
 * The files a static host should serve. Text only, read through the
 * workspace so this works the same on a host disk and in a sandbox.
 */
export async function collectFiles(
  workspace: ProjectWorkspace,
): Promise<{ file: string; data: string }[]> {
  const paths = (await workspace.listFiles()).filter((p) => !SKIP.test(p));
  const files: { file: string; data: string }[] = [];
  for (const file of paths) {
    const data = await workspace.readFile(file);
    if (data !== null) files.push({ file, data });
  }
  return files;
}

/** The exact body Vercel expects. Split out so it can be tested without a token. */
export function vercelPayload(
  name: string,
  files: { file: string; data: string }[],
) {
  return {
    // Vercel project names are lowercase, alphanumeric and dashes, ≤100.
    name: `codefox-${name}`
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 100)
      .replace(/^-|-$/g, ''),
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
): Promise<DeployResult> {
  if (!files.length) {
    return { ok: false, url: '', message: 'This project has no files to deploy.' };
  }
  const res = await post('https://api.vercel.com/v13/deployments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(vercelPayload(name, files)),
  });

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
