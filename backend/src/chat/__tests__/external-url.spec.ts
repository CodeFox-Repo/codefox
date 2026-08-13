import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateExternalApiBaseUrl } from '../external-url';

/**
 * The user hands us a URL and we send their API key to it. That is the shape
 * of an SSRF, so this is the one place in BYOK worth real coverage.
 */
describe('validateExternalApiBaseUrl', () => {
  it.each([
    ['http://api.openai.com/v1', 'plain http puts the key on the wire'],
    ['https://localhost:8080/v1', 'loopback by name'],
    ['https://app.localhost/v1', 'loopback subdomain'],
    ['https://127.0.0.1/v1', 'loopback by address'],
    ['https://169.254.169.254/latest/meta-data/', 'cloud metadata'],
    ['https://metadata.google.internal/v1', 'GCP metadata by name'],
    ['https://10.0.0.5/v1', 'private range'],
    ['https://192.168.1.10/v1', 'private range'],
    ['https://172.16.0.1/v1', 'private range'],
    ['https://100.64.0.1/v1', 'CGNAT'],
    ['https://[::1]/v1', 'IPv6 loopback'],
    ['https://[::ffff:127.0.0.1]/v1', 'IPv4-mapped loopback'],
    ['https://[fd00::1]/v1', 'unique-local'],
    ['not-a-url', 'not a URL at all'],
  ])('rejects %s (%s)', (url) => {
    expect(() => validateExternalApiBaseUrl(url)).toThrow();
  });

  it('accepts the endpoints a user would actually name', () => {
    expect(validateExternalApiBaseUrl('https://openrouter.ai/api/v1')).toBe(
      'https://openrouter.ai/api/v1',
    );
    // Trailing slash normalised — the CLI joins paths onto this.
    expect(validateExternalApiBaseUrl('https://api.openai.com/v1/')).toBe(
      'https://api.openai.com/v1',
    );
  });
});

/**
 * harnessCache is keyed `kind:model`, so a cached credentialled harness would
 * hand user A's key to user B asking for the same model. project-agent.ts
 * imports ESM-only harness packages jest cannot require (the same reason
 * instructions.ts exists), so this reads the source rather than calling it.
 */
describe('a user credential never reaches the harness cache', () => {
  const src = readFileSync(join(__dirname, '../project-agent.ts'), 'utf8');

  it('returns before the cache when a credential is present', () => {
    const credentialled = src.indexOf('if (credential) {');
    const cacheRead = src.indexOf('harnessCache.get(');
    const cacheWrite = src.indexOf('harnessCache.set(');
    expect(credentialled).toBeGreaterThan(-1);
    // The early return has to come first, or the cache owns the key.
    expect(credentialled).toBeLessThan(cacheRead);
    expect(credentialled).toBeLessThan(cacheWrite);
    expect(src.slice(credentialled, cacheRead)).toContain(
      'return createCodex(',
    );
  });

  it('does not clamp a BYOK model to our own list', () => {
    expect(src).toContain('const model = credential');
  });
});
