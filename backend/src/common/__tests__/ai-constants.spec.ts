/**
 * A model tag may name its own provider, so one deployment can serve models
 * that live behind different base URLs. The failure this guards against is
 * silent: routing a model to an endpoint that does not serve it looks like a
 * bad model id, not like missing configuration.
 */
describe('endpointFor', () => {
  const saved = { ...process.env };

  const load = () => {
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('../constants/model-endpoint');
  };

  afterEach(() => {
    process.env = { ...saved };
  });

  it('sends a bare tag to the single-provider endpoint', () => {
    process.env.LLM_BASE_URL = 'https://one.example/v1';
    process.env.LLM_API_KEY = 'k1';
    const { endpointFor } = load();

    expect(endpointFor('gpt-5.4-mini')).toEqual({
      model: 'gpt-5.4-mini',
      baseURL: 'https://one.example/v1',
      apiKey: 'k1',
    });
  });

  it('routes a suffixed tag to that provider, keeping the id clean', () => {
    process.env.LLM_BASE_URL = 'https://one.example/v1';
    process.env.LLM_API_KEY = 'k1';
    process.env.LLM_BASE_URL_FIREWORKS = 'https://api.fireworks.ai/inference/v1';
    process.env.LLM_API_KEY_FIREWORKS = 'fw';
    const { endpointFor } = load();

    expect(endpointFor('accounts/fireworks/models/qwen3p8-max@fireworks')).toEqual({
      model: 'accounts/fireworks/models/qwen3p8-max',
      provider: 'fireworks',
      baseURL: 'https://api.fireworks.ai/inference/v1',
      apiKey: 'fw',
    });
  });

  it('falls back to the shared key when the provider has none of its own', () => {
    process.env.LLM_API_KEY = 'shared';
    process.env.LLM_BASE_URL_CPA = 'http://localhost:8317/v1';
    delete process.env.LLM_API_KEY_CPA;
    const { endpointFor } = load();

    expect(endpointFor('gpt-5.6-luna@cpa').apiKey).toBe('shared');
  });

  it('throws rather than misrouting when the provider is not configured', () => {
    process.env.LLM_BASE_URL = 'https://one.example/v1';
    delete process.env.LLM_BASE_URL_NOWHERE;
    const { endpointFor } = load();

    expect(() => endpointFor('some-model@nowhere')).toThrow(
      /LLM_BASE_URL_NOWHERE is not set/,
    );
  });

  it('treats an id containing @ but no provider as a plain id', () => {
    process.env.LLM_BASE_URL = 'https://one.example/v1';
    const { endpointFor } = load();

    // A leading @ is part of a scoped name, not a provider suffix.
    expect(endpointFor('@scope/model').baseURL).toBe('https://one.example/v1');
    expect(endpointFor('@scope/model').model).toBe('@scope/model');
  });
});
