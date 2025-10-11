import { createOpenAI } from '@ai-sdk/openai';

export const openrouter = createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
});

export const DEFAULT_MODEL = 'anthropic/claude-sonnet-4.5';

export const AVAILABLE_MODELS = [
  'anthropic/claude-sonnet-4.5',
  'openai/gpt-4o-mini',
];
