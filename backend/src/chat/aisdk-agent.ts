import { execFile } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import * as path from 'node:path';
import { Logger } from '@nestjs/common';
import { streamText, stepCountIs, tool } from 'ai';
import { z } from 'zod';
import { modelFor } from '../common/constants/ai.constants';

const logger = new Logger('AiSdkAgent');

/**
 * The in-process agent loop: AI SDK streamText + file tools + bash, working
 * directly on the project directory.
 *
 * The codex CLI gave us this loop at the cost of a bridge process and its
 * /v1/responses protocol — which aggregators translate imperfectly. Fireworks
 * answered its requests with 500s, and OpenRouter's Gemini translation
 * corrupted reasoning signatures mid-conversation, killing every multi-step
 * turn. This path speaks plain chat/completions through the AI SDK, which
 * every provider serves natively, so that entire class of failure is gone.
 *
 * The stream yields the same part shapes the harness did (text-delta,
 * tool-call, error), so the controller consumes either without knowing which
 * ran.
 */

/** Keep every path inside the project directory, symlinks included. */
const resolveInside = (root: string, p: string): string => {
  const full = path.resolve(root, p);
  if (full !== root && !full.startsWith(root + path.sep)) {
    throw new Error(`path escapes the project directory: ${p}`);
  }
  return full;
};

const MAX_READ_CHARS = 60_000;
const BASH_TIMEOUT_MS = 120_000;
const BASH_MAX_OUTPUT = 200_000;

const toolsFor = (root: string) => ({
  write: tool({
    description: 'Create or overwrite a file with the given content.',
    inputSchema: z.object({ path: z.string(), content: z.string() }),
    execute: async ({ path: p, content }) => {
      const full = resolveInside(root, p);
      mkdirSync(path.dirname(full), { recursive: true });
      writeFileSync(full, content);
      return `wrote ${p} (${content.length} chars)`;
    },
  }),
  append: tool({
    description:
      'Append to the end of an existing file. Use this to build a large file across several calls instead of one huge write.',
    inputSchema: z.object({ path: z.string(), content: z.string() }),
    execute: async ({ path: p, content }) => {
      const full = resolveInside(root, p);
      if (!existsSync(full)) {
        throw new Error(`${p} does not exist — write it first`);
      }
      writeFileSync(full, readFileSync(full, 'utf8') + content);
      return `appended ${content.length} chars to ${p} (now ${statSync(full).size})`;
    },
  }),
  read: tool({
    description:
      'Read a file. Optionally only the last N characters, to check how a partial file ends.',
    inputSchema: z.object({ path: z.string(), tail: z.number().optional() }),
    execute: async ({ path: p, tail }) => {
      const s = readFileSync(resolveInside(root, p), 'utf8');
      if (tail) return s.slice(-tail);
      return s.length > MAX_READ_CHARS
        ? `${s.slice(0, MAX_READ_CHARS)}\n…[truncated, file is ${s.length} chars]`
        : s;
    },
  }),
  edit: tool({
    description:
      'Replace an exact string in a file with another. The old string must appear exactly once.',
    inputSchema: z.object({
      path: z.string(),
      old: z.string(),
      new: z.string(),
    }),
    execute: async ({ path: p, old, new: replacement }) => {
      const full = resolveInside(root, p);
      const s = readFileSync(full, 'utf8');
      const n = s.split(old).length - 1;
      if (n === 0) throw new Error('old string not found');
      if (n > 1) throw new Error(`old string appears ${n} times — make it unique`);
      writeFileSync(full, s.replace(old, replacement));
      return `edited ${p}`;
    },
  }),
  list: tool({
    description: 'List files in the project with their sizes.',
    inputSchema: z.object({}),
    execute: async () =>
      (readdirSync(root, { recursive: true }) as string[])
        .filter((f) => {
          try {
            return statSync(path.join(root, f)).isFile();
          } catch {
            return false;
          }
        })
        .filter((f) => !f.startsWith('.git'))
        .map((f) => `${f} (${statSync(path.join(root, f)).size})`)
        .join('\n') || '(empty)',
  }),
  bash: tool({
    description:
      'Run a shell command in the project directory. Two-minute timeout; stdout and stderr are returned. Use for anything the file tools cannot do.',
    inputSchema: z.object({ command: z.string() }),
    execute: ({ command }) =>
      new Promise<string>((done) => {
        execFile(
          '/bin/bash',
          ['-c', command],
          { cwd: root, timeout: BASH_TIMEOUT_MS, maxBuffer: BASH_MAX_OUTPUT * 4 },
          (error, stdout, stderr) => {
            const out = [stdout, stderr].filter(Boolean).join('\n--- stderr ---\n');
            const clipped =
              out.length > BASH_MAX_OUTPUT
                ? `${out.slice(0, BASH_MAX_OUTPUT)}\n…[output truncated]`
                : out;
            // Failures go back as content, not thrown: the model reads the
            // exit state and decides, same as a person at a terminal.
            done(
              error
                ? `exit ${error.code ?? 'signal'}${clipped ? `\n${clipped}` : ''}`
                : clipped || '(no output)',
            );
          },
        );
      }),
  }),
});

export interface AiSdkAgentOptions {
  workingDirectory: string;
  instructions: string;
  prompt: string;
  model?: string;
}

/** Same `{ result, session }` contract runProjectAgent's callers consume. */
export const runAiSdkAgent = ({
  workingDirectory,
  instructions,
  prompt,
  model,
}: AiSdkAgentOptions) => {
  const abort = new AbortController();
  const result = streamText({
    model: modelFor(model),
    system: instructions,
    prompt,
    tools: toolsFor(workingDirectory),
    // Generous: a build turn on a rich page legitimately spends dozens of
    // steps, and the idle watchdog upstream catches a loop that goes nowhere.
    stopWhen: stepCountIs(120),
    abortSignal: abort.signal,
    onError: ({ error }) => logger.error(`stream error: ${error}`),
  });

  return {
    result: { stream: result.fullStream },
    session: {
      // Nothing to persist and no bridge to keep alive — both just stop.
      stop: async () => abort.abort(),
      destroy: async () => abort.abort(),
    },
  };
};
