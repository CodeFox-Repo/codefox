import { createOpenAI } from '@ai-sdk/openai';

/**
 * The LLM backend is any OpenAI-compatible endpoint. Defaults to OpenRouter;
 * point LLM_BASE_URL at a local proxy (CLIProxyAPI, ollama, LM Studio, …) to
 * run against locally-authenticated Claude / Codex CLIs instead — no cloud key.
 *
 * LLM_MODELS is a comma-separated list; the first entry is the default unless
 * LLM_DEFAULT_MODEL says otherwise. Model ids must match what the endpoint
 * serves — OpenRouter ids ("anthropic/claude-sonnet-4.5") differ from a local
 * proxy's ("claude-sonnet-5").
 */
const env = (name: string) => process.env[name]?.trim() || undefined;

export const openrouter = createOpenAI({
  apiKey: env('LLM_API_KEY') ?? env('OPENROUTER_API_KEY'),
  baseURL: env('LLM_BASE_URL') ?? 'https://openrouter.ai/api/v1',
});

export const AVAILABLE_MODELS = (
  env('LLM_MODELS') ?? 'anthropic/claude-sonnet-4.5,openai/gpt-4o-mini'
)
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);

export const DEFAULT_MODEL = env('LLM_DEFAULT_MODEL') ?? AVAILABLE_MODELS[0];
