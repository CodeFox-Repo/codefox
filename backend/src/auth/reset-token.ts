import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * A single-use password reset token, with no new table.
 *
 * The trick: the token is signed with a key derived from the account's
 * CURRENT password hash. Resetting the password changes that hash, which
 * changes the key, which makes every token ever issued for the old password
 * fail to verify. Single use, and every outstanding link is invalidated by
 * the reset — for free, without storing or reaping anything.
 *
 * The password hash never leaves the server and is not recoverable from the
 * token: it is an HMAC key, and what ships is the digest.
 *
 * ponytail: no reset_tokens table, no cleanup job. If tokens ever need
 * server-side revocation before use (an admin killing a link), that is when
 * a table earns its keep.
 */

/** Long enough to check email, short enough that a leaked link goes stale. */
export const RESET_TTL_MS = 30 * 60 * 1000;

const key = (secret: string, passwordHash: string | null) =>
  `${secret}:${passwordHash ?? 'no-password'}`;

const digest = (
  secret: string,
  userId: string,
  passwordHash: string | null,
  expiresAt: number,
) =>
  createHmac('sha256', key(secret, passwordHash))
    .update(`${userId}.${expiresAt}`)
    .digest('base64url');

/** `<userId>.<expiresAt>.<digest>` — opaque to the user, no lookup needed. */
export function signResetToken(
  secret: string,
  userId: string,
  passwordHash: string | null,
  now = Date.now(),
): string {
  const expiresAt = now + RESET_TTL_MS;
  return `${userId}.${expiresAt}.${digest(secret, userId, passwordHash, expiresAt)}`;
}

/** The user id this token is good for, or null for anything wrong with it. */
export function parseResetToken(token: string): {
  userId: string;
  expiresAt: number;
  mac: string;
} | null {
  // Exactly three parts: a userId containing a '.' would otherwise let one
  // token be reinterpreted as another user's.
  const parts = token?.split('.');
  if (!parts || parts.length !== 3) return null;
  const [userId, rawExpiry, mac] = parts;
  const expiresAt = Number(rawExpiry);
  if (!userId || !mac || !Number.isSafeInteger(expiresAt)) return null;
  return { userId, expiresAt, mac };
}

export function verifyResetToken(
  secret: string,
  token: string,
  passwordHash: string | null,
  now = Date.now(),
): boolean {
  const parsed = parseResetToken(token);
  if (!parsed) return false;
  if (parsed.expiresAt <= now) return false;

  const expected = digest(secret, parsed.userId, passwordHash, parsed.expiresAt);
  const a = Buffer.from(expected);
  const b = Buffer.from(parsed.mac);
  // timingSafeEqual throws on a length mismatch, which is itself a signal.
  return a.length === b.length && timingSafeEqual(a, b);
}
