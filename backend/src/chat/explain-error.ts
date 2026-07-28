/**
 * What to tell the user when a turn dies.
 *
 * The generic sentence alone was all anyone ever saw, so a turn that failed
 * because the provider account had run out of credit looked identical to a
 * genuine bug — the actual reason only existed in the server log. These are
 * the causes someone can actually do something about.
 */
export const explain = (error: unknown): string => {
  // The provider's status code and body carry the reason; the SDK's `message`
  // is often just the upstream sentence ("User not found.") with no code in
  // it, so matching on the message alone classified nothing.
  const e = error as any;
  const text =
    typeof error === 'string'
      ? error
      : [
          e?.message,
          e?.statusCode,
          e?.responseBody,
          e?.data && JSON.stringify(e.data),
        ]
          .filter(Boolean)
          .join(' ') || JSON.stringify(error ?? '');

  if (/402|Payment Required|more credits|insufficient/i.test(text)) {
    return 'The model provider rejected the request: the account is out of credit.';
  }
  if (/429|rate.?limit|too many requests/i.test(text)) {
    return 'The model provider is rate limiting this account. Try again shortly.';
  }
  if (/401|403|invalid.*api.?key|unauthorized/i.test(text)) {
    return 'The model provider rejected the API key.';
  }
  if (/context.*length|too many tokens|maximum context/i.test(text)) {
    return 'This conversation is too long for the model. Start a new chat.';
  }
  return 'The agent hit an error and stopped.';
};
