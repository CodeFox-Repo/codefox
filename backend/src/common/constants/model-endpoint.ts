/**
 * The LLM backend is any OpenAI-compatible endpoint. Defaults to OpenRouter;
 * point LLM_BASE_URL at a local proxy (CLIProxyAPI, ollama, LM Studio, …) to
 * run against locally-authenticated Claude / Codex CLIs instead — no cloud key.
 *
 * LLM_MODELS is a comma-separated list; the first entry is the default unless
 * LLM_DEFAULT_MODEL says otherwise. Model ids must match what the endpoint
 * serves — OpenRouter ids ("anthropic/claude-sonnet-4.5") differ from a local
 * proxy's ("claude-sonnet-5").
 *
 * A model may name its own endpoint, for a deployment that needs models from
 * providers with different base URLs — a hosted frontier model beside a
 * locally-proxied one, or two vendors during a migration. Suffix the entry
 * with `@provider` and give that provider its own credentials:
 *
 *   LLM_MODELS=gpt-5.4-mini,qwen3p8-max@fireworks,gpt-5.6-luna@cpa
 *   LLM_BASE_URL_FIREWORKS=https://api.fireworks.ai/inference/v1
 *   LLM_API_KEY_FIREWORKS=fw_…
 *   LLM_BASE_URL_CPA=http://localhost:8317/v1
 *   LLM_API_KEY_CPA=…
 *
 * An entry without `@` uses LLM_BASE_URL / LLM_API_KEY, so a single-provider
 * deployment needs no change.
 */
const env = (name: string) => process.env[name]?.trim() || undefined;

const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';

export interface ModelEndpoint {
  /** What to send the provider — the part before `@`. */
  model: string;
  baseURL: string;
  apiKey?: string;
  /** Provider suffix, absent for the default provider. */
  provider?: string;
}

const suffixOf = (provider: string) => provider.toUpperCase().replace(/\W/g, '_');

/**
 * Where a model lives. `qwen@fireworks` resolves through
 * LLM_BASE_URL_FIREWORKS; a bare id falls back to the single-provider vars.
 */
export const endpointFor = (tag?: string | null): ModelEndpoint => {
  const raw = (tag ?? '').trim();
  const at = raw.lastIndexOf('@');
  if (at <= 0) {
    return {
      model: raw,
      baseURL: env('LLM_BASE_URL') ?? DEFAULT_BASE_URL,
      apiKey: env('LLM_API_KEY') ?? env('OPENROUTER_API_KEY'),
    };
  }
  const provider = raw.slice(at + 1);
  const s = suffixOf(provider);
  const baseURL = env(`LLM_BASE_URL_${s}`);
  if (!baseURL) {
    // Falling back to the default endpoint would send the model somewhere that
    // does not serve it, and the failure would look like a bad model id rather
    // than missing configuration.
    throw new Error(
      `Model "${raw}" names provider "${provider}", but LLM_BASE_URL_${s} is not set.`,
    );
  }
  return {
    model: raw.slice(0, at),
    provider,
    baseURL,
    apiKey: env(`LLM_API_KEY_${s}`) ?? env('LLM_API_KEY'),
  };
};

