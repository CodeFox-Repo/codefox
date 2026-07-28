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
});
