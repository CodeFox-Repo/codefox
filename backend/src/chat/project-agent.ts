import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';
import { Logger } from '@nestjs/common';
import { HarnessAgent } from '@ai-sdk/harness/agent';
import { claudeCode, createClaudeCode } from '@ai-sdk/harness-claude-code';
import { codex, createCodex } from '@ai-sdk/harness-codex';
import { getProjectsDir } from '../common/utils/common-path';
import { runAiSdkAgent } from './aisdk-agent';
import {
  assemblePrompt,
  instructionsFor,
  type PriorTurn,
} from './instructions';
import type { LintFinding } from './lint-artifact';
import { sniff } from '../common/security/file_check';
import {
  AVAILABLE_MODELS,
  DEFAULT_MODEL,
  endpointFor,
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
export type AgentHarness = 'claude-code' | 'codex' | 'aisdk';

// The in-process AI SDK loop is the default: it speaks plain
// chat/completions, which every provider serves natively. The CLI harnesses
// remain reachable by env for the paths that still need them (remote
// sandboxes, BYOK) and for comparison runs.
const agentHarness = (): AgentHarness =>
  process.env.AGENT_HARNESS === 'claude-code'
    ? 'claude-code'
    : process.env.AGENT_HARNESS === 'codex'
      ? 'codex'
      : 'aisdk';

export const harnessId = () =>
  agentHarness() === 'claude-code'
    ? claudeCode.harnessId
    : agentHarness() === 'codex'
      ? codex.harnessId
      : 'aisdk';

const harnessCache = new Map<string, ReturnType<typeof createCodex>>();

/**
 * A CODEX_HOME of our own, so the operator's personal CLI config stays out of
 * the product's requests.
 *
 * The harness only sets CODEX_HOME when it writes skills, and we pass none —
 * so the CLI falls back to ~/.codex and sends whatever is configured there.
 * On a dev box that meant a dozen personal plugins riding every turn: the CLI
 * logged "skill descriptions were shortened to fit the 2% skills context
 * budget" and the endpoint answered 500, killing every turn with zero tool
 * calls. The operator's machine must not be able to change what the product
 * sends.
 */
const codexHome = (): string => {
  const dir = path.join(getProjectsDir(), '.codex-home');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    // Empty but present: the CLI writes its own state here and reads no
    // plugin or skill config, which is the point.
    writeFileSync(path.join(dir, 'config.toml'), '');
  }
  return dir;
};

/**
 * How hard the model thinks before acting — opt-in, and off by default.
 *
 * A build turn plans a whole page, so more thinking should buy a better one.
 * But passing this makes the codex CLI construct a request an
 * OpenAI-compatible endpoint answers with a 500: verified on Fireworks at
 * both 'high' and 'medium', where a direct call carrying reasoning_effort
 * succeeds. Every turn died with zero tool calls. So it stays unset unless a
 * deployment has checked its own endpoint tolerates it.
 */
const reasoningEffort = ():
  | 'low'
  | 'medium'
  | 'high'
  | undefined => {
  const raw = process.env.LLM_REASONING_EFFORT?.trim().toLowerCase();
  return raw === 'low' || raw === 'medium' || raw === 'high' ? raw : undefined;
};

/**
 * One harness per model id. The model is fixed at harness-construction time,
 * so honouring the chat's model picker means keeping an instance per choice
 * rather than a single module-level default.
 */
const harnessFor = (rawModel?: string, credential?: UserCredential) => {
  // A user's own endpoint serves its own model list, so AVAILABLE_MODELS —
  // which describes OUR endpoint — must not clamp their choice.
  const model = credential
    ? (rawModel ?? DEFAULT_MODEL)
    : rawModel && AVAILABLE_MODELS.includes(rawModel)
      ? rawModel
      : DEFAULT_MODEL;
  // Two traps live here: a chat can carry a model the endpoint no longer
  // serves (env config changes between deploys), and a turn with no model at
  // all used to reach the CLI's own baked-in default — which the configured
  // endpoint does not serve either. Both land on OUR default instead.
  if (!credential && rawModel && model !== rawModel) {
    logger.warn(`Model ${rawModel} is not configured; using ${model}`);
  }
  const kind = agentHarness();

  // Never cached: the cache is keyed kind:model, so user A's key would be
  // handed to user B asking for the same model. Building one per turn costs
  // an object; getting this wrong costs someone else's bill.
  if (credential) {
    process.env.CODEX_HOME = codexHome();
    return createCodex({
      model,
      reasoningEffort: reasoningEffort(),
      auth: {
        openaiCompatible: {
          apiKey: credential.apiKey,
          baseUrl: credential.baseUrl,
        },
      },
    });
  }

    // Set before the CLI is spawned; it inherits our env.
  process.env.CODEX_HOME = codexHome();

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
          // The model tag decides the endpoint: a `@provider` suffix routes to
          // that provider's own base URL, so one deployment can serve models
          // that do not share a host.
          const { model: modelId, baseURL, apiKey } = endpointFor(model);
          if (!apiKey) {
            throw new Error(
              'The agent has no credentials. Set LLM_API_KEY to a key for ' +
                'the OpenAI-compatible endpoint in LLM_BASE_URL.',
            );
          }
          return createCodex({
            model: modelId,
            reasoningEffort: reasoningEffort(),
            auth: { openaiCompatible: { apiKey, baseUrl: baseURL } },
          });
        })();

  harnessCache.set(key, created as ReturnType<typeof createCodex>);
  return created;
};

export type { PriorTurn };

export interface ProjectAgentOptions {
  /** Project directory name under .codefox/projects. */
  projectPath: string;
  message: string;
  /** Earlier turns of this chat, oldest first, excluding the current message. */
  history?: PriorTurn[];
  /** Files the user edited by hand since the last turn. */
  handEdits?: { path: string; status: string }[];
  /** Pasted or attached images, as `data:<mime>;base64,<data>` URLs. */
  images?: string[];
  /** Model id for the underlying claude CLI. Unset defers to its default. */
  model?: string;
  /** 'html' runs on host files with the light instructions. */
  template?: string | null;
  /** What the user said they were making; read from the page's meta tag. */
  scenarioId?: string | null;
  /** The project's NOTES.md, so decisions outlive the replay window. */
  notes?: string | null;
  /** What the design linter says about the page as it stands right now. */
  lint?: LintFinding[] | null;
  /** The user's own endpoint for this turn. Never logged, never stored. */
  credential?: UserCredential;
}

/** Codex only — an OpenAI-compatible endpoint cannot drive the claude CLI. */
export interface UserCredential {
  apiKey: string;
  baseUrl: string;
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
  handEdits,
  model,
  template,
  scenarioId,
  credential,
  notes,
  lint,
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
  const prompt = assemblePrompt({ notes, history, handEdits, lint, asked });
  // Hoisted rather than called twice: it is returned below so the turn record
  // can hash exactly what shipped, and two calls are two chances to drift.
  const instructions = instructionsFor(template, scenarioId);

  // The in-process loop needs the files on this disk; a remote sandbox has
  // no local directory to hand it, so those projects stay on the CLI harness.
  if (agentHarness() === 'aisdk' && onHost && !credential) {
    logger.debug(`aisdk agent turn in ${workingDirectory}`);
    const { result, session } = runAiSdkAgent({
      workingDirectory,
      instructions,
      prompt,
      model,
    });
    // Same contract as the CLI path below: the turn record hashes what ran.
    return { result, session, prompt, instructions };
  }

  const agent = new HarnessAgent({
    harness: harnessFor(model, credential),
    instructions,
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
  // The prompt and instructions come back rather than being reassembled by the
  // caller: every piece of them (retell, handEditNote, lintNote, notesNote,
  // the attachment line) is built here, and a second copy in the controller
  // would drift the moment anyone edits this file — silently, into a corpus
  // whose recorded prompts were never the prompts that ran.
  return { result, session, prompt, instructions };
};
