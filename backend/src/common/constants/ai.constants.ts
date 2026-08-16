import { createOpenAI } from '@ai-sdk/openai';
import { endpointFor } from './model-endpoint';

export { endpointFor } from './model-endpoint';
export type { ModelEndpoint } from './model-endpoint';

const env = (name: string) => process.env[name]?.trim() || undefined;

/** A provider client bound to whichever endpoint serves this model. */
export const providerFor = (tag?: string | null) => {
  const { baseURL, apiKey } = endpointFor(tag);
  return createOpenAI({ apiKey, baseURL });
};

/** The model client for a tag — `providerFor(tag)(id)` in one call. */
export const modelFor = (tag?: string | null) => {
  const { model } = endpointFor(tag);
  return providerFor(tag)(model);
};

/** Single-provider client, for callers with no model tag in hand. */
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
