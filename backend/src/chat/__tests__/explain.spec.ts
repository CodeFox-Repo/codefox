import { explain } from '../explain-error';

/**
 * The shapes here are the ones actually seen in production: the AI SDK puts
 * the upstream sentence in `message` and the code in `statusCode` /
 * `responseBody`, so a classifier that reads only `message` matches nothing.
 */
describe('explain', () => {
  it('names an exhausted provider account', () => {
    const message = explain({
      message: 'Reconnecting... 1/5 (unexpected status 402 Payment Required)',
    });
    expect(message).toContain('out of credit');
  });

  it('names a rejected key even when the code is not in the message', () => {
    const message = explain({
      message: 'User not found.',
      statusCode: 401,
      responseBody: '{"error":{"message":"User not found.","code":401}}',
    });
    expect(message).toContain('API key');
  });

  it('names rate limiting', () => {
    expect(explain({ statusCode: 429 })).toContain('rate limiting');
  });

  it('falls back rather than guessing', () => {
    expect(explain({ message: 'socket hang up' })).toBe(
      'The agent hit an error and stopped.',
    );
  });

  /**
   * A sandbox failure carries a provider-shaped status code, so the model
   * rules claimed it: an exhausted *sandbox* quota — the thing blocking
   * Next-mode turns in production — told the user their *model* account was
   * out of credit. The wrong vendor, and the wrong thing to go fix.
   */
  describe('sandbox failures are not model failures', () => {
    it('names the sandbox quota rather than the model account', () => {
      const message = explain({
        message: 'Sandbox creation failed',
        statusCode: 402,
        responseBody: '{"error":{"code":"quota_exceeded"}}',
      });
      expect(message).toContain('sandbox quota');
      expect(message).not.toContain('model provider');
    });

    it('names an unconfigured sandbox', () => {
      expect(
        explain({
          message:
            'SANDBOX_PROVIDER=vercel needs VERCEL_PROJECT_ID. Credentials ' +
            'come from VERCEL_TOKEN, an OIDC token, or a logged-in CLI.',
        }),
      ).toContain('not configured');
    });

    it('says a slow sandbox is worth retrying', () => {
      expect(
        explain({ message: 'Sandbox did not become ready in time' }),
      ).toContain('did not start in time');
    });

    it('still says something specific for an unrecognised sandbox error', () => {
      expect(
        explain({ message: 'Sandbox.getOrCreate failed: ECONNRESET' }),
      ).toBe('The project sandbox could not be reached.');
    });

    it('leaves a genuine model 402 alone', () => {
      expect(
        explain({ message: 'Insufficient credits', statusCode: 402 }),
      ).toContain('out of credit');
    });
  });
});
