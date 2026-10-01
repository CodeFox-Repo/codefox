import {
  classifySignInError,
  getSignInErrorMessage,
  getSignupPasswordState,
  getVerificationFailureMessage,
  getDisplayNameErrorMessage,
  SIGNUP_PASSWORD_HELP,
} from '../auth-copy';

describe('auth outcome copy', () => {
  it('uses display-name terminology for existing server validation outcomes', () => {
    expect(
      getDisplayNameErrorMessage('A username is between 3 and 32 characters.')
    ).toMatch(/3 and 32 characters.*display name/);
    expect(getDisplayNameErrorMessage('That username is taken.')).toMatch(
      /display name is already in use/
    );
    expect(getDisplayNameErrorMessage('private diagnostic')).toBe(
      'We couldn’t update your display name. Try again.'
    );
  });

  it('does not blame credentials for a network or unknown failure', () => {
    expect(classifySignInError({ networkError: new Error('offline') })).toBe(
      'network'
    );
    expect(
      getSignInErrorMessage({ networkError: new Error('offline') })
    ).toMatch(/complete sign-in/);
    expect(
      classifySignInError({
        graphQLErrors: [{ message: 'Database unavailable' }],
      })
    ).toBe('unknown');
    expect(
      getSignInErrorMessage({
        graphQLErrors: [{ message: 'Database unavailable' }],
      })
    ).not.toMatch(/password|Database/);
  });

  it('only explains verification when the existing backend explicitly reports it', () => {
    expect(
      classifySignInError({
        graphQLErrors: [
          { message: 'Email not confirmed. Please check your inbox.' },
        ],
      })
    ).toBe('verification');
    expect(
      getSignInErrorMessage({
        graphQLErrors: [
          { message: 'Email not confirmed. Please check your inbox.' },
        ],
      })
    ).toMatch(/verify your account/);
    expect(
      classifySignInError({
        graphQLErrors: [{ message: 'Invalid credentials' }],
      })
    ).toBe('credentials');
    // Unknown, inactive, deleted, and wrong-password accounts all use this one
    // server response. Never branch on or reveal a more specific account state.
    expect(
      getSignInErrorMessage({
        graphQLErrors: [{ message: 'Invalid credentials' }],
      })
    ).toBe('Email or password is incorrect. Check your details and try again.');
    expect(
      classifySignInError({ graphQLErrors: [{ message: 'User inactive' }] })
    ).toBe('unknown');
  });

  it('removes implementation jargon from verification failures', () => {
    for (const message of [
      'Invalid token format',
      'Invalid or expired token',
      'Email already confirmed or user not found.',
      'private diagnostic',
    ]) {
      expect(getVerificationFailureMessage(message)).not.toMatch(
        /token|private diagnostic|user not found/
      );
    }
    expect(getVerificationFailureMessage('Invalid or expired token')).toMatch(
      /latest verification email/
    );
  });
});

describe('signup password help preserves existing policy', () => {
  it('describes six characters and any two character types', () => {
    expect(SIGNUP_PASSWORD_HELP).toMatch(
      /at least 6 characters and at least two/
    );
    for (const value of [
      'abcdef1',
      'ABCDEF1',
      'abcDEF',
      'abcde!',
      '12345!',
      'ABCDE!',
    ]) {
      expect(getSignupPasswordState(value).error).toBeNull();
    }
    for (const value of ['', 'Ab1!', 'abcdef', 'ABCDEF', '123456', '!!!!!!']) {
      expect(getSignupPasswordState(value).error).not.toBeNull();
    }
  });

  it('matches the old validator over every character-class combination and length boundary', () => {
    const old = (value: string) =>
      value.length >= 6 &&
      [
        /[A-Z]/.test(value),
        /[a-z]/.test(value),
        /\d/.test(value),
        /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(value),
      ].filter(Boolean).length >= 2;
    for (let mask = 0; mask < 16; mask++) {
      const seed =
        ['A', 'a', '1', '!']
          .filter((_, index) => mask & (1 << index))
          .join('') || ' ';
      for (let length = 0; length < 12; length++) {
        const value = seed.repeat(12).slice(0, length);
        expect(getSignupPasswordState(value).error === null).toBe(old(value));
      }
    }
    for (const symbol of '!@#$%^&*()_+-=[]{};\':"\\|,.<>/?') {
      expect(getSignupPasswordState(`aaaaa${symbol}`).error).toBeNull();
    }
  });
});
