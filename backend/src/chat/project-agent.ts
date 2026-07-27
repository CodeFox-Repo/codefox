import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { Logger } from '@nestjs/common';
import { HarnessAgent } from '@ai-sdk/harness/agent';
import { claudeCode, createClaudeCode } from '@ai-sdk/harness-claude-code';
import { getProjectsDir } from '../common/utils/common-path';
import { sandboxFor, sandboxMode } from './sandbox-provider';

const logger = new Logger('ProjectAgent');

/** Attachments land here, inside the project so the agent's sandbox covers them. */
const UPLOAD_DIR = '.codefox-uploads';

/**
 * The agent is Claude Code itself, embedded through the AI SDK harness. It
 * brings its own file editing, search, and shell tools, so nothing is
 * re-implemented here — the only thing CodeFox supplies is the sandbox the
 * agent runs in, which is the project's own directory.
 *
 * Auth points at whatever Anthropic-compatible endpoint is configured, so a
 * local proxy in front of an already-signed-in Claude CLI works without any
 * cloud API key.
 */
const harnessCache = new Map<string, ReturnType<typeof createClaudeCode>>();

/**
 * One harness per model id. The model is fixed at harness-construction time,
 * so honouring the chat's model picker means keeping an instance per choice
 * rather than a single module-level default.
 */
const harnessFor = (model?: string) => {
  // With none of these set the CLI still starts and then retries a 4xx ten
  // times with backoff, so the turn hangs for minutes and the user sees
  // nothing. On a fresh deploy that is the very first thing they would hit.
  if (
    !process.env.ANTHROPIC_API_KEY &&
    !process.env.ANTHROPIC_AUTH_TOKEN &&
    !process.env.ANTHROPIC_BASE_URL
  ) {
    throw new Error(
      'The agent has no Anthropic credentials. Set ANTHROPIC_API_KEY, or ' +
        'ANTHROPIC_BASE_URL to an Anthropic-compatible endpoint. Note that ' +
        'an OpenAI-compatible endpoint (LLM_BASE_URL / OpenRouter) drives ' +
        'the prompt helpers but cannot drive the agent.',
    );
  }

  const key = model ?? '';
  const cached = harnessCache.get(key);
  if (cached) return cached;

  const created = createClaudeCode({
    model,
    auth: {
      anthropic: {
        baseUrl: process.env.ANTHROPIC_BASE_URL,
        apiKey: process.env.ANTHROPIC_API_KEY,
        authToken: process.env.ANTHROPIC_AUTH_TOKEN,
      },
    },
  });
  harnessCache.set(key, created);
  return created;
};

const INSTRUCTIONS = `You are CodeFox, building a Next.js 15 + Tailwind + shadcn/ui app.

The working directory already contains a scaffolded project. Edit it in place.
The main page is src/app/page.tsx.

Match the conventions already in the project — read a file before rewriting it,
and reuse the components that are already there instead of adding new ones.
Finish with a short summary of what you changed.`;

export interface ProjectAgentOptions {
  /** Project directory name under .codefox/projects. */
  projectPath: string;
  message: string;
  /** Pasted or attached images, as `data:<mime>;base64,<data>` URLs. */
  images?: string[];
  /** Model id for the underlying claude CLI. Unset defers to its default. */
  model?: string;
}

const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/**
 * Put attached images where the agent can reach them.
 *
 * The claude-code harness rejects non-text prompt parts outright, but Claude
 * Code has a Read tool and the sandbox is the project directory — so an image
 * on disk with its path named in the prompt is a working channel where an
 * inline image part is not.
 */
async function stageImages(
  workingDirectory: string,
  images: string[],
): Promise<string[]> {
  const dir = path.join(workingDirectory, UPLOAD_DIR);
  await mkdir(dir, { recursive: true });

  const written: string[] = [];
  for (const image of images) {
    const match = /^data:([^;]+);base64,(.+)$/s.exec(image);
    if (!match) {
      logger.warn('Skipping attachment that is not a base64 data URL');
      continue;
    }
    const [, mime, data] = match;
    const extension = EXTENSIONS[mime];
    if (!extension) {
      logger.warn(`Skipping attachment of unsupported type ${mime}`);
      continue;
    }
    const name = `${randomUUID()}.${extension}`;
    await writeFile(path.join(dir, name), Buffer.from(data, 'base64'));
    // Absolute: Claude Code's Read tool rejects relative paths, and a
    // rejected read costs the agent a find(1) round trip to recover.
    written.push(path.join(dir, name));
  }
  return written;
}

export const runProjectAgent = async ({
  projectPath,
  message,
  images,
  model,
}: ProjectAgentOptions) => {
  const workingDirectory = path.join(getProjectsDir(), projectPath);

  // Images are staged onto the backend's own disk, which only the host
  // sandbox can see. In a remote sandbox that path resolves to nothing, so
  // say the attachment was dropped rather than point the agent at a file it
  // cannot open.
  if (images?.length && sandboxMode() !== 'host') {
    logger.warn(
      `Dropping ${images.length} attachment(s): image staging is not wired ` +
        'up for remote sandboxes yet.',
    );
  }
  const staged =
    images?.length && sandboxMode() === 'host'
      ? await stageImages(workingDirectory, images)
      : [];
  const prompt = staged.length
    ? `${message}\n\nThe user attached ${staged.length === 1 ? 'this image' : 'these images'} — read ${staged.length === 1 ? 'it' : 'them'} before answering:\n${staged.map((f) => `- ${f}`).join('\n')}`
    : message;

  const agent = new HarnessAgent({
    harness: harnessFor(model),
    instructions: INSTRUCTIONS,
    sandbox: sandboxFor({
      projectPath,
      harnessId: claudeCode.harnessId,
    }) as any,
  });

  const session = await agent.createSession();
  logger.debug(`agent session started in ${workingDirectory}`);

  const result = await agent.stream({ session, prompt });
  return { result, session };
};
