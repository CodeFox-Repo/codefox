import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { Logger } from '@nestjs/common';
import { HarnessAgent } from '@ai-sdk/harness/agent';
import { claudeCode, createClaudeCode } from '@ai-sdk/harness-claude-code';
import { codex, createCodex } from '@ai-sdk/harness-codex';
import { getProjectsDir } from '../common/utils/common-path';
import { sniff } from '../common/security/file_check';
import {
  AVAILABLE_MODELS,
  DEFAULT_MODEL,
} from '../common/constants/ai.constants';
import {
  SANDBOX_ROOT,
  sandboxFor,
  sandboxHandle,
  sandboxMode,
} from './sandbox-provider';

const logger = new Logger('ProjectAgent');

/** Attachments land here, inside the project so the agent's sandbox covers them. */
const UPLOAD_DIR = '.codefox-uploads';

/**
 * The agent is a real coding CLI embedded through the AI SDK harness — it
 * brings its own file editing, search and shell tools, so nothing is
 * re-implemented here. CodeFox only supplies the sandbox it runs in.
 *
 * Which CLI is a deployment decision:
 *
 * `claude-code` speaks the Anthropic Messages API. An OpenAI-compatible
 * endpoint cannot drive it — pointing it at OpenRouter gets the CLI as far as
 * a response it classifies as `unknown`, then ten retries with backoff and a
 * turn that never produces a token.
 *
 * `codex` speaks the OpenAI API and takes an explicit openai-compatible base
 * url, which is what makes an aggregator like OpenRouter usable — and with it
 * any model that aggregator serves, including Anthropic's.
 */
export type AgentHarness = 'claude-code' | 'codex';

const agentHarness = (): AgentHarness =>
  process.env.AGENT_HARNESS === 'claude-code' ? 'claude-code' : 'codex';

export const harnessId = () =>
  agentHarness() === 'claude-code' ? claudeCode.harnessId : codex.harnessId;

const harnessCache = new Map<string, ReturnType<typeof createCodex>>();

/**
 * One harness per model id. The model is fixed at harness-construction time,
 * so honouring the chat's model picker means keeping an instance per choice
 * rather than a single module-level default.
 */
const harnessFor = (rawModel?: string) => {
  // Two traps live here: a chat can carry a model the endpoint no longer
  // serves (env config changes between deploys), and a turn with no model at
  // all used to reach the CLI's own baked-in default — which the configured
  // endpoint does not serve either. Both land on OUR default instead.
  const model =
    rawModel && AVAILABLE_MODELS.includes(rawModel) ? rawModel : DEFAULT_MODEL;
  if (rawModel && model !== rawModel) {
    logger.warn(`Model ${rawModel} is not configured; using ${model}`);
  }
  const kind = agentHarness();
  const key = `${kind}:${model ?? ''}`;
  const cached = harnessCache.get(key);
  if (cached) return cached;

  // Without credentials the CLI still starts and then retries a 4xx ten times
  // with backoff, so the turn hangs for minutes and the user sees nothing. On
  // a fresh deploy that is the very first thing they would hit.
  const created =
    kind === 'claude-code'
      ? (() => {
          if (
            !process.env.ANTHROPIC_API_KEY &&
            !process.env.ANTHROPIC_AUTH_TOKEN &&
            !process.env.ANTHROPIC_BASE_URL
          ) {
            throw new Error(
              'AGENT_HARNESS=claude-code needs ANTHROPIC_API_KEY, or ' +
                'ANTHROPIC_BASE_URL pointing at an Anthropic-compatible ' +
                'endpoint. An OpenAI-compatible one cannot drive it — use ' +
                'the codex harness for those.',
            );
          }
          return createClaudeCode({
            model,
            auth: {
              anthropic: {
                baseUrl: process.env.ANTHROPIC_BASE_URL,
                apiKey: process.env.ANTHROPIC_API_KEY,
                authToken: process.env.ANTHROPIC_AUTH_TOKEN,
              },
            },
          });
        })()
      : (() => {
          const apiKey =
            process.env.LLM_API_KEY ?? process.env.OPENROUTER_API_KEY;
          if (!apiKey) {
            throw new Error(
              'The agent has no credentials. Set LLM_API_KEY to a key for ' +
                'the OpenAI-compatible endpoint in LLM_BASE_URL.',
            );
          }
          return createCodex({
            model,
            auth: {
              openaiCompatible: {
                apiKey,
                baseUrl:
                  process.env.LLM_BASE_URL ?? 'https://openrouter.ai/api/v1',
              },
            },
          });
        })();

  harnessCache.set(key, created as ReturnType<typeof createCodex>);
  return created;
};

const HTML_INSTRUCTIONS = `You are CodeFox, building self-contained HTML pages.

The working directory holds a handful of .html files — index.html is the
page. Edit them in place. Everything stays in the HTML files: Tailwind via
the CDN script tag that is already there, inline <script> for behavior. No
package.json, no build step, no framework — if a page needs more structure,
add another .html file and link to it.

index.html carries a design system in its <style> :root block — colors,
type scale, radii, spacing, motion. That block is the page's style
contract. Build against the variables (var(--accent), var(--surface),
var(--text-3xl), var(--radius-md)) instead of picking your own colors,
fonts or sizes, and give every new page you add the same :root block so
the site stays one design. Change a token's VALUE only when the user asks
for a different look — then change it in :root, where it restyles
everything at once, never by hardcoding a hex somewhere in the markup.
`;

const INSTRUCTIONS = `You are CodeFox, building a Next.js 15 + Tailwind + shadcn/ui app.

The working directory already contains a scaffolded project. Edit it in place.
The main page is src/app/page.tsx.

Plan before you build. On the first message of a project, when the request
leaves real product choices open — audience, tone, pages, content, data —
do not build yet. Reply with ONLY a question block, no other prose and no
file edits, so the UI can render the choices:

\`\`\`codefox-questions
{"intro":"One sentence saying what you understood.","questions":[{"id":"style","label":"Question text","multi":false,"options":["Option A","Option B"]}]}
\`\`\`

2 to 4 questions, 2 to 5 short options each, "multi": true when several can
apply at once. Write the intro, questions and options in the user's language.
Ask at most once per project: when a message answers your questions, or the
request is already specific enough to act on, build without asking again.

Match the conventions already in the project — read a file before rewriting it,
and reuse the components that are already there instead of adding new ones.
Finish with a short summary of what you changed.`;

const PLAN_SECTION = INSTRUCTIONS.slice(
  INSTRUCTIONS.indexOf('Plan before you build.'),
  INSTRUCTIONS.indexOf('Match the conventions'),
);

const instructionsFor = (template?: string | null): string =>
  template === 'html'
    ? `${HTML_INSTRUCTIONS}\n${PLAN_SECTION}\nFinish with a short summary of what you changed.`
    : INSTRUCTIONS;

/** One earlier turn, oldest first. */
export interface PriorTurn {
  role: string;
  content: string;
}

/** How much of the conversation to replay, and how much of each turn. */
const HISTORY_TURNS = 20;
const HISTORY_CHARS = 2000;

/**
 * Retell the conversation so far.
 *
 * Every turn gets a brand-new agent session, so without this the agent saw
 * only the sentence just typed: told a preference in one message it answered
 * "Unknown" when asked about it in the next, and a follow-up like "make it
 * bigger" had no referent at all.
 *
 * Replayed as text rather than resumed through the harness on purpose — a
 * resumable session lives in a bridge process that does not survive a deploy,
 * and this server redeploys constantly.
 */
const retell = (history: PriorTurn[]): string => {
  const recent = history.slice(-HISTORY_TURNS);
  if (recent.length === 0) return '';

  const lines = recent.map((turn) => {
    const who = /assistant/i.test(turn.role) ? 'Assistant' : 'User';
    const said =
      turn.content.length > HISTORY_CHARS
        ? `${turn.content.slice(0, HISTORY_CHARS)}…`
        : turn.content;
    return `${who}: ${said}`;
  });

  return `Earlier in this conversation:\n\n${lines.join('\n\n')}\n\n---\n\n`;
};

export interface ProjectAgentOptions {
  /** Project directory name under .codefox/projects. */
  projectPath: string;
  message: string;
  /** Earlier turns of this chat, oldest first, excluding the current message. */
  history?: PriorTurn[];
  /** Pasted or attached images, as `data:<mime>;base64,<data>` URLs. */
  images?: string[];
  /** Model id for the underlying claude CLI. Unset defers to its default. */
  model?: string;
  /** 'html' runs on host files with the light instructions. */
  template?: string | null;
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
/** A data URL turned into the bytes and file name it should be saved under. */
/** Same ceiling the avatar and cover paths enforce. */
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

function decodeImage(
  image: string,
): { name: string; bytes: Buffer } | undefined {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(image);
  if (!match) {
    logger.warn('Skipping attachment that is not a base64 data URL');
    return undefined;
  }
  const [, mime, data] = match;
  if (!EXTENSIONS[mime]) {
    logger.warn(`Skipping attachment of unsupported type ${mime}`);
    return undefined;
  }

  // Base64 is 4 characters per 3 bytes; measuring before decoding means a
  // huge attachment is refused without first materialising it in memory.
  if ((data.length * 3) / 4 > MAX_ATTACHMENT_BYTES) {
    logger.warn('Skipping attachment over 5MB');
    return undefined;
  }

  const bytes = Buffer.from(data, 'base64');

  // The declared type decided the extension and nothing looked at the bytes,
  // so anything at all could be written to disk as a .png and handed to the
  // agent as an image. Name the file after what it actually is — the same
  // rule uploads follow, by the same sniffer.
  const actual = sniff(bytes);
  if (!actual || !EXTENSIONS[actual]) {
    logger.warn('Skipping attachment that is not an image');
    return undefined;
  }

  return {
    name: `${randomUUID()}.${EXTENSIONS[actual]}`,
    bytes,
  };
}

async function stageImagesOnHost(
  workingDirectory: string,
  images: string[],
): Promise<string[]> {
  const dir = path.join(workingDirectory, UPLOAD_DIR);
  await mkdir(dir, { recursive: true });

  const written: string[] = [];
  for (const image of images) {
    const decoded = decodeImage(image);
    if (!decoded) continue;
    await writeFile(path.join(dir, decoded.name), decoded.bytes);
    // Absolute: Claude Code's Read tool rejects relative paths, and a
    // rejected read costs the agent a find(1) round trip to recover.
    written.push(path.join(dir, decoded.name));
  }
  return written;
}

/**
 * Same job, into the sandbox instead of onto this disk.
 *
 * Attachments used to be dropped outright whenever the agent was not running
 * on the host, so pasting a screenshot silently did nothing the moment the
 * project moved into a real sandbox.
 */
async function stageImagesInSandbox(
  projectPath: string,
  images: string[],
): Promise<string[]> {
  const decoded = images
    .map(decodeImage)
    .filter((item): item is { name: string; bytes: Buffer } => Boolean(item));
  if (decoded.length === 0) return [];

  const sandbox = await sandboxHandle(projectPath);
  const dir = `${SANDBOX_ROOT}/${UPLOAD_DIR}`;
  await sandbox.runCommand({ cmd: 'mkdir', args: ['-p', dir] });
  await sandbox.writeFiles(
    decoded.map(({ name, bytes }) => ({
      path: `${dir}/${name}`,
      content: new Uint8Array(bytes),
    })),
  );
  return decoded.map(({ name }) => `${dir}/${name}`);
}

export const runProjectAgent = async ({
  projectPath,
  message,
  images,
  history,
  model,
  template,
}: ProjectAgentOptions) => {
  const workingDirectory = path.join(getProjectsDir(), projectPath);

  // Images are staged onto the backend's own disk, which only the host
  // sandbox can see. In a remote sandbox that path resolves to nothing, so
  // say the attachment was dropped rather than point the agent at a file it
  // cannot open.
  const onHost = sandboxMode() === 'host' || template === 'html';
  const staged = !images?.length
    ? []
    : onHost
      ? await stageImagesOnHost(workingDirectory, images)
      : await stageImagesInSandbox(projectPath, images);
  const asked = staged.length
    ? `${message}\n\nThe user attached ${staged.length === 1 ? 'this image' : 'these images'} — read ${staged.length === 1 ? 'it' : 'them'} before answering:\n${staged.map((f) => `- ${f}`).join('\n')}`
    : message;
  const prompt = `${retell(history ?? [])}${asked}`;

  const agent = new HarnessAgent({
    harness: harnessFor(model),
    instructions: instructionsFor(template),
    // html projects live on the host in every mode — their agent edits those
    // files directly. NOTE: that trades away microVM isolation for them;
    // seed-a-sandbox is the follow-up before registration opens.
    sandbox: (await sandboxFor({
      projectPath,
      harnessId: harnessId(),
      forceHost: template === 'html',
    })) as any,
  });

  const session = await agent.createSession();
  logger.debug(`agent session started in ${workingDirectory}`);

  const result = await agent.stream({ session, prompt });
  return { result, session };
};
