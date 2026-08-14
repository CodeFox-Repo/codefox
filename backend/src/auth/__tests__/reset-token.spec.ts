import {
  RESET_TTL_MS,
  parseResetToken,
  signResetToken,
  verifyResetToken,
} from '../reset-token';

const SECRET = 'test-secret';
const HASH = '$2b$10$abcdefghijklmnopqrstuv';

describe('reset token', () => {
  it('verifies a token it just signed', () => {
    const token = signResetToken(SECRET, 'user-1', HASH);
    expect(verifyResetToken(SECRET, token, HASH)).toBe(true);
  });

  it('is single use: resetting the password kills the token', () => {
    // This is the whole design — no table, no reaping. The key includes the
    // current password hash, so a new hash cannot verify an old token.
    const token = signResetToken(SECRET, 'user-1', HASH);
    expect(verifyResetToken(SECRET, token, '$2b$10$aDIFFERENTnewhash00000')).toBe(
      false,
    );
  });

  it('every outstanding link dies with the reset, not just the one used', () => {
    const first = signResetToken(SECRET, 'user-1', HASH);
    const second = signResetToken(SECRET, 'user-1', HASH);
    const after = '$2b$10$aDIFFERENTnewhash00000';
    expect(verifyResetToken(SECRET, first, after)).toBe(false);
    expect(verifyResetToken(SECRET, second, after)).toBe(false);
  });

  it('expires', () => {
    const now = Date.now();
    const token = signResetToken(SECRET, 'user-1', HASH, now);
    expect(verifyResetToken(SECRET, token, HASH, now + RESET_TTL_MS - 1000)).toBe(
      true,
    );
    expect(verifyResetToken(SECRET, token, HASH, now + RESET_TTL_MS + 1000)).toBe(
      false,
    );
  });

  it('refuses a token signed with another secret', () => {
    const token = signResetToken('other-secret', 'user-1', HASH);
    expect(verifyResetToken(SECRET, token, HASH)).toBe(false);
  });

  it('refuses a token whose expiry was pushed out by hand', () => {
    const token = signResetToken(SECRET, 'user-1', HASH);
    const [id, , mac] = token.split('.');
    const forged = `${id}.${Date.now() + 10 * RESET_TTL_MS}.${mac}`;
    expect(verifyResetToken(SECRET, forged, HASH)).toBe(false);
  });

  it('refuses a token retargeted at another user', () => {
    const token = signResetToken(SECRET, 'user-1', HASH);
    const [, expiry, mac] = token.split('.');
    expect(verifyResetToken(SECRET, `victim.${expiry}.${mac}`, HASH)).toBe(false);
  });

  it('refuses malformed input rather than throwing', () => {
    for (const bad of [
      '',
      'nonsense',
      'a.b',
      // A userId containing a dot would let one token be read as another's.
      'a.b.c.d',
      'user-1.notanumber.mac',
      `user-1.${Date.now() + 1000}.`,
    ]) {
      expect(verifyResetToken(SECRET, bad, HASH)).toBe(false);
    }
    expect(parseResetToken('a.b')).toBeNull();
    expect(parseResetToken('a.b.c.d')).toBeNull();
  });

  it('refuses an account with no password (Google sign-in)', () => {
    const token = signResetToken(SECRET, 'user-1', null);
    // A null-password account never gets a link, but if one were minted it
    // must not unlock an account that later set a password.
    expect(verifyResetToken(SECRET, token, HASH)).toBe(false);
  });

  it('does not leak the password hash', () => {
    const token = signResetToken(SECRET, 'user-1', HASH);
    expect(token).not.toContain(HASH);
    expect(token).not.toContain(SECRET);
  });
});
