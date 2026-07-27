import * as path from 'node:path';
import { Logger } from '@nestjs/common';
import { HarnessAgent } from '@ai-sdk/harness/agent';
import { claudeCode, createClaudeCode } from '@ai-sdk/harness-claude-code';
import { getProjectsDir } from '../common/utils/common-path';
import { createLocalSandbox } from './local-sandbox';

const logger = new Logger('ProjectAgent');

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
const harness = createClaudeCode({
  auth: {
    anthropic: {
      baseUrl: process.env.ANTHROPIC_BASE_URL,
      apiKey: process.env.ANTHROPIC_API_KEY,
      authToken: process.env.ANTHROPIC_AUTH_TOKEN,
    },
  },
});

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
}

export const runProjectAgent = async ({
  projectPath,
  message,
}: ProjectAgentOptions) => {
  const workingDirectory = path.join(getProjectsDir(), projectPath);

  const agent = new HarnessAgent({
    harness,
    instructions: INSTRUCTIONS,
    sandbox: createLocalSandbox({
      workingDirectory,
      harnessId: claudeCode.harnessId,
    }) as any,
  });

  const session = await agent.createSession();
  logger.debug(`agent session started in ${workingDirectory}`);

  const result = await agent.stream({ session, prompt: message });
  return { result, session };
};
