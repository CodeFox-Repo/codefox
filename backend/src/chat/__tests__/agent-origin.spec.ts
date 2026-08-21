import { agentOrigin } from '../agent-origin';

const req = (headers: Record<string, string>, protocol = 'http'): any => ({
  headers,
  protocol,
});

/**
 * These links exist to be fetched by something that is not a browser, so a
 * scheme the server does not speak is not a cosmetic problem: curl fails with
 * ERR_SSL_WRONG_VERSION_NUMBER and the agent reads it as "the project has no
 * page".
 */
describe('agentOrigin', () => {
  it('keeps the deployed origin exactly as the proxy reports it', () => {
    expect(
      agentOrigin(
        req(
          {
            'x-forwarded-host': 'codefox.dev',
            'x-forwarded-proto': 'https',
            host: 'backend-production.up.railway.app',
          },
          'http',
        ),
      ),
    ).toBe('https://codefox.dev');
  });

  it('hands a plain-http backend an http link', () => {
    expect(agentOrigin(req({ host: 'localhost:8099' }))).toBe(
      'http://localhost:8099',
    );
  });

  it('leaves a direct https request alone', () => {
    expect(agentOrigin(req({ host: 'codefox.dev' }, 'https'))).toBe(
      'https://codefox.dev',
    );
  });

  it('falls back to PUBLIC_ORIGIN when the request names no host', () => {
    process.env.PUBLIC_ORIGIN = 'https://codefox.dev';
    try {
      expect(agentOrigin(req({}))).toBe('https://codefox.dev');
    } finally {
      delete process.env.PUBLIC_ORIGIN;
    }
  });
});
