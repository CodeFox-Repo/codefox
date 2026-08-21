import type { Request } from 'express';
import { publicOrigin } from '../project/social-card';

/**
 * The origin to hand a caller that will actually curl these links.
 *
 * `publicOrigin` assumes https whenever no proxy said otherwise, which is
 * right for a deploy behind a TLS terminator and wrong for a backend running
 * on plain http: a local agent handed `https://localhost:8099/share/…` gets
 * ERR_SSL_WRONG_VERSION_NUMBER, not a page. Nothing was forwarded in that
 * case, so the request's own scheme is the honest answer.
 *
 * The deployed path is untouched: Railway and the Vercel rewrite both send
 * x-forwarded-proto, so the guess below is never reached there.
 *
 * Its own file rather than a helper in the controller: that one imports the
 * agent stack, which is ESM, and a unit test cannot follow it.
 */
export function agentOrigin(req: Request): string {
  const origin = publicOrigin(req);
  if (!origin) return process.env.PUBLIC_ORIGIN ?? '';
  return !req.headers['x-forwarded-proto'] && req.protocol === 'http'
    ? origin.replace(/^https:/, 'http:')
    : origin;
}
